import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { logger as rootLogger } from "../logger";
import type { HonoEnv } from "../types";
import { db } from "../db/client";
import { ingredients, recipeTags, recipes, tags } from "../db/schema";

export const exportRouter = new Hono<HonoEnv>();

function parseNumeric(v: string | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

// ---------------------------------------------------------------------------
// GET /export
// ---------------------------------------------------------------------------

exportRouter.get("/export", async (c) => {
  const [allRecipes, allIngredients, allRecipeTags, allTags] = await Promise.all([
    db.select().from(recipes),
    db.select().from(ingredients),
    db
      .select({ recipeId: recipeTags.recipeId, tag: tags })
      .from(recipeTags)
      .innerJoin(tags, eq(recipeTags.tagId, tags.id)),
    db.select().from(tags),
  ]);

  // Group ingredients by recipeId
  const ingredientsByRecipe = new Map<string, typeof allIngredients>();
  for (const ing of allIngredients) {
    const arr = ingredientsByRecipe.get(ing.recipeId) ?? [];
    arr.push(ing);
    ingredientsByRecipe.set(ing.recipeId, arr);
  }

  // Group tags by recipeId
  const tagsByRecipe = new Map<string, (typeof allTags)[number][]>();
  for (const { recipeId, tag } of allRecipeTags) {
    const arr = tagsByRecipe.get(recipeId) ?? [];
    arr.push(tag);
    tagsByRecipe.set(recipeId, arr);
  }

  const exportedRecipes = allRecipes.map((recipe) => {
    const recipeIngredients = (ingredientsByRecipe.get(recipe.id) ?? [])
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((ing) => ({ ...ing, quantity: parseNumeric(ing.quantity as unknown as string) }));
    const recipeTags2 = tagsByRecipe.get(recipe.id) ?? [];
    return { ...recipe, ingredients: recipeIngredients, tags: recipeTags2 };
  });

  const log = c.var.logger ?? rootLogger;
  log.info({ recipeCount: allRecipes.length, tagCount: allTags.length }, "export served");

  return c.json({
    exportedAt: new Date().toISOString(),
    recipes: exportedRecipes,
    tags: allTags,
  });
});
