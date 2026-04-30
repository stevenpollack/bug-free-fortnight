import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HttpError } from "../errors";
import { importRecipeTinEats } from "../import/recipetineats";
import { ImportPreviewBody } from "../schemas/index";

export const importRouter = new Hono();

// ---------------------------------------------------------------------------
// POST /import/preview
// ---------------------------------------------------------------------------

importRouter.post("/import/preview", zValidator("json", ImportPreviewBody), async (c) => {
  const { url } = c.req.valid("json");

  const result = await importRecipeTinEats(url).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    throw new HttpError(422, "IMPORT_ERROR", message);
  });

  return c.json(result);
});
