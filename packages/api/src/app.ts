import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { HttpError } from "./errors";
import { logger } from "./logger";
import { requestLogger } from "./middleware/requestLogger";
import { configRouter } from "./routes/config";
import { exportRouter } from "./routes/export";
import { importRouter } from "./routes/import";
import { logRouter } from "./routes/log";
import { mealPlanRouter } from "./routes/mealPlans";
import { recipeRouter } from "./routes/recipes";
import { schemaRouter } from "./routes/schemas";
import { shoppingListRouter } from "./routes/shoppingList";
import { tagRouter } from "./routes/tags";
import type { HonoEnv } from "./types";

export interface AppOptions {
  webDistDir?: string;
}

export function createApp({ webDistDir }: AppOptions = {}) {
  const app = new Hono<HonoEnv>();

  // CORS is only needed in development (dev web server runs on a different port).
  // In production the API serves the SPA same-origin, so no CORS header is required.
  if (process.env.NODE_ENV !== "production") {
    app.use(
      "/api/*",
      cors({
        origin: process.env.CORS_ORIGIN?.split(",") ?? ["http://localhost:5173"],
        allowMethods: ["OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE"],
      }),
    );
  }

  app.use(requestLogger);

  app.onError((err, c) => {
    if (err instanceof HttpError) {
      return c.json({ error: { code: err.code, message: err.message } }, err.statusCode as 400);
    }
    logger.error({ err }, "unhandled error");
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } }, 500);
  });

  app.get("/api/health", (c) => c.json({ ok: true }));

  app.route("/api", configRouter);
  app.route("/api", exportRouter);
  app.route("/api", importRouter);
  app.route("/api", logRouter);
  app.route("/api", mealPlanRouter);
  app.route("/api", recipeRouter);
  app.route("/api", schemaRouter);
  app.route("/api", shoppingListRouter);
  app.route("/api", tagRouter);

  if (webDistDir) {
    // Serve static assets (JS, CSS, images, etc.) from the built SPA directory.
    app.use("/*", serveStatic({ root: webDistDir }));

    // SPA fallback: any GET that reached here and has no file extension is a
    // TanStack Router deep-link — return index.html so client-side routing works.
    app.get("*", async (c) => {
      const { pathname } = new URL(c.req.url);
      if (pathname.includes(".")) {
        return c.notFound();
      }
      const file = Bun.file(`${webDistDir}/index.html`);
      return new Response(file, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    });
  }

  return app;
}

export const app = createApp();
