import { Hono } from "hono";
import { z } from "zod";
import { RecipeCreate } from "../schemas";
import type { HonoEnv } from "../types";

export const schemaRouter = new Hono<HonoEnv>();

const recipeJsonSchema = z.toJSONSchema(RecipeCreate);

schemaRouter.get("/schemas/recipe", (c) => {
  return c.json(recipeJsonSchema);
});
