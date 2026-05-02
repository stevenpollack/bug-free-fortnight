import { asc, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { tags } from "../db/schema";
import { newId } from "../db/uuid";
import { HttpError } from "../errors";

type TagRow = typeof tags.$inferSelect;

export async function listTags(): Promise<TagRow[]> {
  return db.select().from(tags).orderBy(sql`${tags.category} nulls last`, asc(tags.name));
}

export async function createTag(name: string, category?: string | null): Promise<TagRow> {
  const normalizedName = name.trim().toLowerCase();
  const newTagId = newId();

  await db
    .insert(tags)
    .values({ id: newTagId, name: normalizedName, category: category ?? null })
    .onConflictDoNothing({ target: tags.name });

  const [tag] = await db.select().from(tags).where(eq(tags.name, normalizedName));
  if (!tag) throw new HttpError(500, "INTERNAL_ERROR", "Failed to upsert tag");
  return tag;
}

export async function deleteTag(id: string): Promise<void> {
  const result = await db.delete(tags).where(eq(tags.id, id)).returning({ id: tags.id });
  if (result.length === 0) throw new HttpError(404, "NOT_FOUND", "Tag not found");
}
