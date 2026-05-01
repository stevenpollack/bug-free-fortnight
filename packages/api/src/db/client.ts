import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { logger } from "../logger";
import * as schema from "./schema";

const debugSql = process.env.DEBUG_SQL === "1";

// DATABASE_URL is validated at startup (index.ts) before this module is imported.
export const sql = postgres(process.env.DATABASE_URL ?? "", {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
  onnotice: (notice) => logger.debug({ notice }, "pg notice"),
  ...(debugSql
    ? {
        debug: (_conn, query, params) => {
          logger.debug({ query, params }, "sql");
        },
      }
    : {}),
});

export const db = drizzle(sql, {
  schema,
  ...(debugSql
    ? {
        logger: {
          logQuery(query: string, params: unknown[]) {
            logger.debug({ query, params }, "drizzle query");
          },
        },
      }
    : { logger: false }),
});
