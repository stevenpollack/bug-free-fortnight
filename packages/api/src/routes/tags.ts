import { zValidator } from "@hono/zod-validator";
import { asc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/client";
import { tags } from "../db/schema";
import { newId } from "../db/uuid";
import { HttpError } from "../errors";
import { logger as rootLogger } from "../logger";
import { TagInput } from "../schemas/index";
import type { HonoEnv } from "../types";

export const tagRouter = new Hono<HonoEnv>();

// ---------------------------------------------------------------------------
// GET /tags
// ---------------------------------------------------------------------------

tagRouter.get("/tags", async (c) => {
  // category NULLS LAST, then by name
  const rows = await db
    .select()
    .from(tags)
    .orderBy(sql`${tags.category} nulls last`, asc(tags.name));

  return c.json({ tags: rows });
});

// ---------------------------------------------------------------------------
// POST /tags  (idempotent upsert — returns existing tag if name already used)
// ---------------------------------------------------------------------------

tagRouter.post("/tags", zValidator("json", TagInput), async (c) => {
  const body = c.req.valid("json");
  const normalizedName = body.name.trim().toLowerCase();
  const newTagId = newId();

  // Try idempotent insert; on conflict (name) do nothing
  await db
    .insert(tags)
    .values({ id: newTagId, name: normalizedName, category: body.category ?? null })
    .onConflictDoNothing({ target: tags.name });

  // Always fetch by name so we return the canonical row (existing or new)
  const [tag] = await db.select().from(tags).where(eq(tags.name, normalizedName));
  if (!tag) throw new HttpError(500, "INTERNAL_ERROR", "Failed to upsert tag");

  const created = tag.id === newTagId;
  const log = c.var.logger ?? rootLogger;
  log.info({ tagId: tag.id, name: normalizedName, created }, "tag upserted");

  return c.json({ tag }, 201);
});

// ---------------------------------------------------------------------------
// DELETE /tags/:id
// ---------------------------------------------------------------------------

tagRouter.delete("/tags/:id", async (c) => {
  const id = c.req.param("id");
  const result = await db.delete(tags).where(eq(tags.id, id)).returning({ id: tags.id });
  if (result.length === 0) throw new HttpError(404, "NOT_FOUND", "Tag not found");
  const log = c.var.logger ?? rootLogger;
  log.info({ tagId: id }, "tag deleted");
  return new Response(null, { status: 204 });
});
