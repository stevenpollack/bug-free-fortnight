import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { tags } from "./schema";
import type * as schema from "./schema";
import { newId } from "./uuid";

export interface CanonicalTag {
  name: string;
  category: string;
}

/** Canonical tags shipped with the app. Households add more from the UI. */
export const CANONICAL_TAGS: CanonicalTag[] = [
  { name: "asian", category: "cuisine" },
  { name: "western", category: "cuisine" },
  { name: "italian", category: "cuisine" },
  { name: "slow cooker", category: "method" },
  { name: "one pot", category: "method" },
  { name: "breakfast", category: "meal_type" },
  { name: "dinner", category: "meal_type" },
  { name: "dessert", category: "meal_type" },
  { name: "weeknight", category: "practical" },
  { name: "freezer friendly", category: "practical" },
];

/**
 * Idempotently insert the canonical tag set.
 * Safe to run on every boot — uses ON CONFLICT (name) DO NOTHING.
 */
export async function seedCanonicalTags(db: PostgresJsDatabase<typeof schema>): Promise<void> {
  const rows = CANONICAL_TAGS.map((t) => ({ id: newId(), ...t }));
  await db.insert(tags).values(rows).onConflictDoNothing({ target: tags.name });
  console.log(`[seed] canonical tags ensured (${rows.length} entries)`);
}
