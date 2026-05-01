import { Hono } from "hono";
import { z } from "zod";
import { LlmMealPlanOutput, RecipeCreate } from "../schemas";
import type { HonoEnv } from "../types";

const recipeJsonSchema = z.toJSONSchema(RecipeCreate);
const mealPlanJsonSchema = z.toJSONSchema(LlmMealPlanOutput);

export const schemaRouter = new Hono<HonoEnv>()
  .get("/schemas/recipe", (c) => {
    return c.json(recipeJsonSchema);
  })
  .get("/schemas/meal-plan", (c) => {
    return c.json(mealPlanJsonSchema);
  });
