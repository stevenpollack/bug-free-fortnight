import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/client";
import { ingredients, recipeTags, recipes, type tags } from "../db/schema";
import { newId } from "../db/uuid";
import { HttpError } from "../errors";
import { logger as rootLogger } from "../logger";
import { RecipeCreate, RecipeUpdate } from "../schemas/index";
import type { HonoEnv } from "../types";

export const recipeRouter = new Hono<HonoEnv>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseNumeric(v: string | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

type RecipeRow = typeof recipes.$inferSelect;
type IngredientRow = typeof ingredients.$inferSelect;
type TagRow = typeof tags.$inferSelect;

interface IngredientRead extends Omit<IngredientRow, "quantity"> {
  quantity: number | null;
}

interface RecipeListItem extends RecipeRow {
  tagIds: string[];
}

interface RecipeDetail extends RecipeRow {
  tagIds: string[];
  ingredients: IngredientRead[];
}

function toIngredientRead(row: IngredientRow): IngredientRead {
  return { ...row, quantity: parseNumeric(row.quantity as unknown as string) };
}

/** Group a flat join result (recipe + optional tagId) into a map keyed by recipeId. */
function groupByRecipe(rows: Array<{ recipe: RecipeRow; tagId: string | null }>): RecipeListItem[] {
  const map = new Map<string, RecipeListItem>();
  for (const row of rows) {
    const existing = map.get(row.recipe.id);
    if (existing) {
      if (row.tagId) existing.tagIds.push(row.tagId);
    } else {
      map.set(row.recipe.id, { ...row.recipe, tagIds: row.tagId ? [row.tagId] : [] });
    }
  }
  return [...map.values()];
}

async function fetchFullRecipe(id: string): Promise<RecipeDetail> {
  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, id));
  if (!recipe) throw new HttpError(404, "NOT_FOUND", "Recipe not found");

  const ingredientRows = await db
    .select()
    .from(ingredients)
    .where(eq(ingredients.recipeId, id))
    .orderBy(ingredients.displayOrder);

  const tagRows = await db
    .select({ tagId: recipeTags.tagId })
    .from(recipeTags)
    .where(eq(recipeTags.recipeId, id));

  return {
    ...recipe,
    tagIds: tagRows.map((r) => r.tagId),
    ingredients: ingredientRows.map(toIngredientRead),
  };
}

// ---------------------------------------------------------------------------
// Query schema for GET /recipes
// ---------------------------------------------------------------------------

const RecipeListQuery = z.object({
  q: z.string().optional(),
  // `tag` may appear multiple times; coerce to array
  tag: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v])),
  favourite: z
    .string()
    .optional()
    .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
});

// ---------------------------------------------------------------------------
// GET /recipes
// ---------------------------------------------------------------------------

recipeRouter.get("/recipes", zValidator("query", RecipeListQuery), async (c) => {
  const { q, tag: filterTagIds, favourite } = c.req.valid("query");

  const conditions: ReturnType<typeof eq>[] = [];

  if (q) {
    conditions.push(
      or(ilike(recipes.title, `%${q}%`), ilike(recipes.description, `%${q}%`)) as ReturnType<
        typeof eq
      >,
    );
  }

  if (favourite !== undefined) {
    conditions.push(eq(recipes.favourite, favourite) as unknown as ReturnType<typeof eq>);
  }

  // AND tag semantics: recipe must have ALL specified tags
  if (filterTagIds.length > 0) {
    const taggedRows = await db
      .select({ recipeId: recipeTags.recipeId })
      .from(recipeTags)
      .where(inArray(recipeTags.tagId, filterTagIds))
      .groupBy(recipeTags.recipeId)
      .having(sql`count(distinct ${recipeTags.tagId}) = ${filterTagIds.length}`);

    const ids = taggedRows.map((r) => r.recipeId);
    if (ids.length === 0) return c.json({ recipes: [] });
    conditions.push(inArray(recipes.id, ids) as unknown as ReturnType<typeof eq>);
  }

  const rows = await db
    .select({ recipe: recipes, tagId: recipeTags.tagId })
    .from(recipes)
    .leftJoin(recipeTags, eq(recipes.id, recipeTags.recipeId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(recipes.updatedAt));

  return c.json({ recipes: groupByRecipe(rows) });
});

// ---------------------------------------------------------------------------
// GET /recipes/:id
// ---------------------------------------------------------------------------

recipeRouter.get("/recipes/:id", async (c) => {
  const recipe = await fetchFullRecipe(c.req.param("id"));
  return c.json({ recipe });
});

// ---------------------------------------------------------------------------
// POST /recipes
// ---------------------------------------------------------------------------

recipeRouter.post("/recipes", zValidator("json", RecipeCreate), async (c) => {
  const body = c.req.valid("json");
  const recipeId = newId();
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(recipes).values({
      id: recipeId,
      title: body.title,
      description: body.description ?? null,
      sourceUrl: body.sourceUrl ?? null,
      imageUrl: body.imageUrl ?? null,
      baseServings: body.baseServings,
      prepTimeMinutes: body.prepTimeMinutes ?? null,
      cookTimeMinutes: body.cookTimeMinutes ?? null,
      notes: body.notes ?? null,
      instructions: body.instructions,
      favourite: body.favourite,
      createdAt: now,
      updatedAt: now,
    });

    if (body.ingredients.length > 0) {
      await tx.insert(ingredients).values(
        body.ingredients.map((ing, idx) => ({
          id: newId(),
          recipeId,
          displayOrder: ing.displayOrder ?? idx,
          groupHeading: ing.groupHeading ?? null,
          quantity: ing.quantity != null ? String(ing.quantity) : null,
          unit: ing.unit ?? null,
          item: ing.item,
          notes: ing.notes ?? null,
          originalLine: ing.originalLine ?? ing.item,
        })),
      );
    }

    if (body.tagIds.length > 0) {
      await tx.insert(recipeTags).values(body.tagIds.map((tagId) => ({ recipeId, tagId })));
    }
  });

  const recipe = await fetchFullRecipe(recipeId);
  const log = c.var.logger ?? rootLogger;
  log.info(
    { recipeId, ingredientCount: body.ingredients.length, tagCount: body.tagIds.length },
    "recipe created",
  );
  return c.json({ recipe }, 201);
});

// ---------------------------------------------------------------------------
// PUT /recipes/:id
// ---------------------------------------------------------------------------

recipeRouter.put("/recipes/:id", zValidator("json", RecipeUpdate), async (c) => {
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const now = new Date();

  await db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: recipes.id }).from(recipes).where(eq(recipes.id, id));
    if (!existing) throw new HttpError(404, "NOT_FOUND", "Recipe not found");

    await tx
      .update(recipes)
      .set({
        title: body.title,
        description: body.description ?? null,
        sourceUrl: body.sourceUrl ?? null,
        imageUrl: body.imageUrl ?? null,
        baseServings: body.baseServings,
        prepTimeMinutes: body.prepTimeMinutes ?? null,
        cookTimeMinutes: body.cookTimeMinutes ?? null,
        notes: body.notes ?? null,
        instructions: body.instructions,
        favourite: body.favourite,
        updatedAt: now,
      })
      .where(eq(recipes.id, id));

    await tx.delete(ingredients).where(eq(ingredients.recipeId, id));
    if (body.ingredients.length > 0) {
      await tx.insert(ingredients).values(
        body.ingredients.map((ing, idx) => ({
          id: newId(),
          recipeId: id,
          displayOrder: ing.displayOrder ?? idx,
          groupHeading: ing.groupHeading ?? null,
          quantity: ing.quantity != null ? String(ing.quantity) : null,
          unit: ing.unit ?? null,
          item: ing.item,
          notes: ing.notes ?? null,
          originalLine: ing.originalLine ?? ing.item,
        })),
      );
    }

    await tx.delete(recipeTags).where(eq(recipeTags.recipeId, id));
    if (body.tagIds.length > 0) {
      await tx.insert(recipeTags).values(body.tagIds.map((tagId) => ({ recipeId: id, tagId })));
    }
  });

  const recipe = await fetchFullRecipe(id);
  const log = c.var.logger ?? rootLogger;
  log.info(
    { recipeId: id, ingredientCount: body.ingredients.length, tagCount: body.tagIds.length },
    "recipe updated",
  );
  return c.json({ recipe });
});

// ---------------------------------------------------------------------------
// DELETE /recipes/:id
// ---------------------------------------------------------------------------

recipeRouter.delete("/recipes/:id", async (c) => {
  const id = c.req.param("id");
  const result = await db.delete(recipes).where(eq(recipes.id, id)).returning({ id: recipes.id });
  if (result.length === 0) throw new HttpError(404, "NOT_FOUND", "Recipe not found");
  const log = c.var.logger ?? rootLogger;
  log.info({ recipeId: id }, "recipe deleted");
  return new Response(null, { status: 204 });
});

// ---------------------------------------------------------------------------
// POST /recipes/:id/favourite  (toggle)
// ---------------------------------------------------------------------------

recipeRouter.post("/recipes/:id/favourite", async (c) => {
  const id = c.req.param("id");
  const [current] = await db
    .select({ favourite: recipes.favourite })
    .from(recipes)
    .where(eq(recipes.id, id));
  if (!current) throw new HttpError(404, "NOT_FOUND", "Recipe not found");

  await db
    .update(recipes)
    .set({ favourite: !current.favourite, updatedAt: new Date() })
    .where(eq(recipes.id, id));

  const recipe = await fetchFullRecipe(id);
  const log = c.var.logger ?? rootLogger;
  log.info({ recipeId: id, favourite: recipe.favourite }, "favourite toggled");
  return c.json({ recipe });
});

export type { RecipeDetail, RecipeListItem, IngredientRead, TagRow };
