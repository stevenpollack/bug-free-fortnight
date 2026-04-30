import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// DATABASE_URL is validated at startup (index.ts) before this module is imported.
export const sql = postgres(process.env.DATABASE_URL ?? "", {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
});

export const db = drizzle(sql, { schema });
