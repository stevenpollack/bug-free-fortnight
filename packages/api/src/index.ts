import { createApp } from "./app";
import { logger } from "./logger";

const webDistDir = process.env.WEB_DIST_DIR;
const app = createApp({ webDistDir });

export { app };

if (import.meta.main) {
  if (!process.env.DATABASE_URL) {
    logger.error("DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  const { db } = await import("./db/client");
  const { runMigrations } = await import("./db/migrate");
  const { seedCanonicalTags } = await import("./db/seed");

  await runMigrations();
  await seedCanonicalTags(db);

  const port = Number(process.env.PORT ?? 3001);
  Bun.serve({ port, fetch: app.fetch });

  if (webDistDir) {
    logger.info({ webDistDir }, "serving SPA");
  }
  logger.info({ port }, "API listening");
}
