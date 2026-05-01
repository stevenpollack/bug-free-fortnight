import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HttpError } from "../errors";
import { importRecipeTinEats } from "../import/recipetineats";
import { ImportPreviewBody } from "../schemas/index";
import type { HonoEnv } from "../types";

export const importRouter = new Hono<HonoEnv>().post(
  "/import/preview",
  zValidator("json", ImportPreviewBody),
  async (c) => {
    const { url } = c.req.valid("json");
    const log = c.var.logger;

    const result = await importRecipeTinEats(url, fetch, log).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      throw new HttpError(422, "IMPORT_ERROR", message);
    });

    log.info(
      {
        url,
        warningsCount: result.warnings.length,
        ingredientCount: result.recipe.ingredients.length,
        instructionCount: result.recipe.instructions.length,
      },
      "import preview success",
    );

    return c.json(result);
  },
);
