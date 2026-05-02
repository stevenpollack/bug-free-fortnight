import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "../db/client";
import { ingredients, recipeTags, recipes } from "../db/schema";
import { newId } from "../db/uuid";
import { HttpError } from "../errors";
import { buildIngredientRows, parseNumeric } from "../lib/utils";
import type { RecipeCreate, RecipeUpdate } from "../schemas/index";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RecipeRow = typeof recipes.$inferSelect;
type IngredientRow = typeof ingredients.$inferSelect;

export interface IngredientRead extends Omit<IngredientRow, "quantity"> {
  quantity: number | null;
}

export interface RecipeListItem extends RecipeRow {
  tagIds: string[];
}

export interface RecipeDetail extends RecipeRow {
  tagIds: string[];
  ingredients: IngredientRead[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function toIngredientRead(row: IngredientRow): IngredientRead {
  return { ...row, quantity: parseNumeric(row.quantity as unknown as string) };
}

export function groupByRecipe(
  rows: Array<{ recipe: RecipeRow; tagId: string | null }>,
): RecipeListItem[] {
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

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export async function fetchFullRecipe(id: string): Promise<RecipeDetail> {
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

export async function searchRecipes(params: {
  q?: string;
  tagIds?: string[];
  favourite?: boolean;
}): Promise<RecipeListItem[]> {
  const conditions: ReturnType<typeof eq>[] = [];

  if (params.q) {
    conditions.push(
      or(
        ilike(recipes.title, `%${params.q}%`),
        ilike(recipes.description, `%${params.q}%`),
      ) as ReturnType<typeof eq>,
    );
  }

  if (params.favourite !== undefined) {
    conditions.push(eq(recipes.favourite, params.favourite) as unknown as ReturnType<typeof eq>);
  }

  if (params.tagIds && params.tagIds.length > 0) {
    const taggedRows = await db
      .select({ recipeId: recipeTags.recipeId })
      .from(recipeTags)
      .where(inArray(recipeTags.tagId, params.tagIds))
      .groupBy(recipeTags.recipeId)
      .having(sql`count(distinct ${recipeTags.tagId}) = ${params.tagIds.length}`);

    const ids = taggedRows.map((r) => r.recipeId);
    if (ids.length === 0) return [];
    conditions.push(inArray(recipes.id, ids) as unknown as ReturnType<typeof eq>);
  }

  const rows = await db
    .select({ recipe: recipes, tagId: recipeTags.tagId })
    .from(recipes)
    .leftJoin(recipeTags, eq(recipes.id, recipeTags.recipeId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(recipes.updatedAt));

  return groupByRecipe(rows);
}

export async function createRecipe(body: RecipeCreate): Promise<RecipeDetail> {
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
      await tx.insert(ingredients).values(buildIngredientRows(recipeId, body.ingredients));
    }

    if (body.tagIds.length > 0) {
      await tx.insert(recipeTags).values(body.tagIds.map((tagId) => ({ recipeId, tagId })));
    }
  });

  return fetchFullRecipe(recipeId);
}

export async function updateRecipe(id: string, body: RecipeUpdate): Promise<RecipeDetail> {
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
      await tx.insert(ingredients).values(buildIngredientRows(id, body.ingredients));
    }

    await tx.delete(recipeTags).where(eq(recipeTags.recipeId, id));
    if (body.tagIds.length > 0) {
      await tx.insert(recipeTags).values(body.tagIds.map((tagId) => ({ recipeId: id, tagId })));
    }
  });

  return fetchFullRecipe(id);
}

export async function deleteRecipe(id: string): Promise<void> {
  const result = await db.delete(recipes).where(eq(recipes.id, id)).returning({ id: recipes.id });
  if (result.length === 0) throw new HttpError(404, "NOT_FOUND", "Recipe not found");
}

export async function toggleFavourite(id: string): Promise<RecipeDetail> {
  const [current] = await db
    .select({ favourite: recipes.favourite })
    .from(recipes)
    .where(eq(recipes.id, id));
  if (!current) throw new HttpError(404, "NOT_FOUND", "Recipe not found");

  await db
    .update(recipes)
    .set({ favourite: !current.favourite, updatedAt: new Date() })
    .where(eq(recipes.id, id));

  return fetchFullRecipe(id);
}
