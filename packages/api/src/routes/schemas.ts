import { Hono } from "hono";
import { z } from "zod";
import { LlmMealPlanOutput, RecipeCreate } from "../schemas";
import type { HonoEnv } from "../types";

export const schemaRouter = new Hono<HonoEnv>();

const recipeJsonSchema = z.toJSONSchema(RecipeCreate);
const mealPlanJsonSchema = z.toJSONSchema(LlmMealPlanOutput);

schemaRouter.get("/schemas/recipe", (c) => {
  return c.json(recipeJsonSchema);
});

schemaRouter.get("/schemas/meal-plan", (c) => {
  return c.json(mealPlanJsonSchema);
});
