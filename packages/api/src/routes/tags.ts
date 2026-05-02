import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { TagInput } from "../schemas/index";
import { createTag, deleteTag, listTags } from "../services/tags";
import type { HonoEnv } from "../types";

export const tagRouter = new Hono<HonoEnv>()
  .get("/tags", async (c) => {
    const tags = await listTags();
    return c.json({ tags });
  })
  .post("/tags", zValidator("json", TagInput), async (c) => {
    const body = c.req.valid("json");
    const tag = await createTag(body.name, body.category);
    const log = c.var.logger;
    log.info({ tagId: tag.id, name: tag.name }, "tag upserted");
    return c.json({ tag }, 201);
  })
  .delete("/tags/:id", async (c) => {
    const id = c.req.param("id");
    await deleteTag(id);
    const log = c.var.logger;
    log.info({ tagId: id }, "tag deleted");
    return new Response(null, { status: 204 });
  });
