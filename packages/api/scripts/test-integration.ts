/**
 * Integration test runner.
 *
 * 1. Sets DATABASE_URL so db/client.ts picks up the test DB.
 * 2. Runs Drizzle migrations.
 * 3. Seeds canonical tags.
 * 4. Spawns `bun test` scoped to *.integration.test.ts files.
 * 5. After exit (pass or fail) truncates data tables + reseeds for clean reruns.
 */

const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://test:test@localhost:5433/test";

process.env.DATABASE_URL = DATABASE_URL;

// Dynamic imports after env is set so db/client.ts singleton uses the right URL.
const { drizzle } = await import("drizzle-orm/postgres-js");
const postgres = (await import("postgres")).default;
const { runMigrations } = await import("../src/db/migrate");
const { seedCanonicalTags } = await import("../src/db/seed");
const schema = await import("../src/db/schema");

console.log("[test-integration] DATABASE_URL:", DATABASE_URL);

await runMigrations();

const migrateSql = postgres(DATABASE_URL, { max: 1 });
const seedDb = drizzle(migrateSql, { schema });
await seedCanonicalTags(seedDb);

const glob = new Bun.Glob("src/**/*.integration.test.ts");
const files = await Array.fromAsync(glob.scan({ cwd: `${import.meta.dir}/..`, onlyFiles: true }));

if (files.length === 0) {
  console.error("[test-integration] no *.integration.test.ts files found");
  await migrateSql.end();
  process.exit(1);
}

console.log(`[test-integration] running ${files.length} integration test file(s)`);

const proc = Bun.spawn(["bun", "test", "--timeout", "30000", ...files], {
  cwd: `${import.meta.dir}/..`,
  stdout: "inherit",
  stderr: "inherit",
  env: { ...process.env, DATABASE_URL },
});

const exitCode = await proc.exited;

try {
  console.log("[test-integration] truncating data tables for next run...");
  await migrateSql.unsafe(
    "TRUNCATE recipes, ingredients, tags, recipe_tags RESTART IDENTITY CASCADE",
  );
  await seedCanonicalTags(seedDb);
  console.log("[test-integration] teardown complete");
} catch (err) {
  console.error("[test-integration] teardown failed (non-fatal):", err);
} finally {
  await migrateSql.end();
}

process.exit(exitCode);
