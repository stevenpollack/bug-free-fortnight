import { createMiddleware } from "hono/factory";
import { newId } from "../db/uuid";
import { logger as rootLogger } from "../logger";
import type { HonoEnv } from "../types";

export const requestLogger = createMiddleware<HonoEnv>(async (c, next) => {
  const requestId = newId();
  const reqLogger = rootLogger.child({ requestId });

  c.set("requestId", requestId);
  c.set("logger", reqLogger);

  const isHealth = c.req.path === "/api/health";
  const startMs = Date.now();

  if (isHealth) {
    reqLogger.debug({ method: c.req.method, path: c.req.path }, "request start");
  } else {
    reqLogger.info({ method: c.req.method, path: c.req.path }, "request start");
  }

  await next();

  const durationMs = Date.now() - startMs;

  if (isHealth) {
    reqLogger.debug(
      { method: c.req.method, path: c.req.path, status: c.res.status, durationMs },
      "request end",
    );
  } else {
    reqLogger.info(
      { method: c.req.method, path: c.req.path, status: c.res.status, durationMs },
      "request end",
    );
  }
});
