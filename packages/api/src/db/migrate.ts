import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { logger } from "../logger";

/**
 * Stable 64-bit advisory lock id used to serialise concurrent API boots.
 * Chosen value: 0xFADE_CAFE_FEED (281474959933677n), harmless constant.
 * Exported so tests can verify it is a valid signed bigint.
 */
export const MIGRATION_LOCK_ID = 281_474_959_933_677n;

const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../drizzle");

/**
 * Run pending Drizzle migrations behind a Postgres advisory lock so that
 * concurrent API boots do not race on schema changes.
 *
 * Uses a dedicated single-connection pool for the lock so the lock is never
 * held on a shared pooled connection.
 */
export async function runMigrations(): Promise<void> {
  // DATABASE_URL is validated at startup before runMigrations is called.
  const url = process.env.DATABASE_URL ?? "";
  const lockSql = postgres(url, { max: 1, connect_timeout: 10 });
  const migrationDb = drizzle(lockSql);

  logger.info("acquiring advisory lock");
  // Use unsafe() because postgres-js cannot serialise BigInt as a parameter.
  await lockSql.unsafe(`SELECT pg_advisory_lock(${MIGRATION_LOCK_ID})`);
  logger.info("lock acquired, running migrations");

  try {
    await migrate(migrationDb, { migrationsFolder });
    logger.info("migrations complete");
  } catch (err) {
    logger.error({ err }, "migration failed");
    throw err;
  } finally {
    await lockSql.unsafe(`SELECT pg_advisory_unlock(${MIGRATION_LOCK_ID})`);
    await lockSql.end();
  }
}
