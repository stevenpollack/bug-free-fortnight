import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { logger as rootLogger } from "../logger";
import { ClientLogBody } from "../schemas/index";
import type { HonoEnv } from "../types";

export const logRouter = new Hono<HonoEnv>();

// ---------------------------------------------------------------------------
// POST /log
// ---------------------------------------------------------------------------

logRouter.post("/log", zValidator("json", ClientLogBody), (c) => {
  const { level, message, fields, scope } = c.req.valid("json");
  const log = c.var.logger ?? rootLogger;
  log.child({ source: "web", scope })[level](fields ?? {}, message);
  return new Response(null, { status: 204 });
});
