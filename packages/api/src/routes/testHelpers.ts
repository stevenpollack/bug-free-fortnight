/**
 * Shared helpers for integration tests.
 * NOT imported by production code — only *.integration.test.ts files.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema";
import { seedCanonicalTags } from "../db/seed";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://test:test@localhost:5433/test";

// Shared connection for test helpers (truncate + reseed).
// Do NOT call .end() in individual test files — connections are closed on process exit.
const testSql = postgres(DATABASE_URL, { max: 1 });
export const testDb = drizzle(testSql, { schema });

/**
 * Truncate all data tables and re-seed canonical tags.
 * Call from beforeEach in every integration test file.
 */
export async function resetDb(): Promise<void> {
  await testSql.unsafe(
    "TRUNCATE meal_plan_slots, meal_plans, recipes, ingredients, tags, recipe_tags RESTART IDENTITY CASCADE",
  );
  await seedCanonicalTags(testDb);
}
