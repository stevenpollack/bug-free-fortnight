import { Hono } from "hono";

const app = new Hono();

app.get("/api/health", (c) => {
  return c.json({ ok: true });
});

export { app };

if (import.meta.main) {
  if (!process.env.DATABASE_URL) {
    console.error("[startup] DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  const { db, sql } = await import("./db/client");
  const { runMigrations } = await import("./db/migrate");
  const { seedCanonicalTags } = await import("./db/seed");

  await runMigrations();
  await seedCanonicalTags(db);

  // Close the migration/seed connections before serving
  const port = Number(process.env.PORT ?? 3001);
  Bun.serve({ port, fetch: app.fetch });
  console.log(`[startup] API listening on port ${port}`);

  // keep the sql pool alive for the server lifetime
  void sql;
}
