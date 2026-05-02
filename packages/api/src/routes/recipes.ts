import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { RecipeCreate, RecipeUpdate } from "../schemas/index";
import {
  createRecipe,
  deleteRecipe,
  fetchFullRecipe,
  searchRecipes,
  toggleFavourite,
  updateRecipe,
} from "../services/recipes";
import type { HonoEnv } from "../types";

const RecipeListQuery = z.object({
  q: z.string().optional(),
  tag: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v])),
  favourite: z
    .string()
    .optional()
    .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
});

export const recipeRouter = new Hono<HonoEnv>()
  .get("/recipes", zValidator("query", RecipeListQuery), async (c) => {
    const { q, tag: tagIds, favourite } = c.req.valid("query");
    const recipes = await searchRecipes({ q, tagIds, favourite });
    return c.json({ recipes });
  })
  .get("/recipes/:id", async (c) => {
    const recipe = await fetchFullRecipe(c.req.param("id"));
    return c.json({ recipe });
  })
  .post("/recipes", zValidator("json", RecipeCreate), async (c) => {
    const body = c.req.valid("json");
    const recipe = await createRecipe(body);
    const log = c.var.logger;
    log.info(
      {
        recipeId: recipe.id,
        ingredientCount: body.ingredients.length,
        tagCount: body.tagIds.length,
      },
      "recipe created",
    );
    return c.json({ recipe }, 201);
  })
  .put("/recipes/:id", zValidator("json", RecipeUpdate), async (c) => {
    const id = c.req.param("id");
    const body = c.req.valid("json");
    const recipe = await updateRecipe(id, body);
    const log = c.var.logger;
    log.info(
      { recipeId: id, ingredientCount: body.ingredients.length, tagCount: body.tagIds.length },
      "recipe updated",
    );
    return c.json({ recipe });
  })
  .delete("/recipes/:id", async (c) => {
    const id = c.req.param("id");
    await deleteRecipe(id);
    const log = c.var.logger;
    log.info({ recipeId: id }, "recipe deleted");
    return new Response(null, { status: 204 });
  })
  .post("/recipes/:id/favourite", async (c) => {
    const id = c.req.param("id");
    const recipe = await toggleFavourite(id);
    const log = c.var.logger;
    log.info({ recipeId: id, favourite: recipe.favourite }, "favourite toggled");
    return c.json({ recipe });
  });

export type { RecipeDetail, RecipeListItem, IngredientRead } from "../services/recipes";
