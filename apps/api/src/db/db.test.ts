import { describe, expect, test } from "bun:test";
import { MIGRATION_LOCK_ID } from "./migrate";
import { CANONICAL_TAGS } from "./seed";
import { newId } from "./uuid";

// ---------------------------------------------------------------------------
// UUIDv7
// ---------------------------------------------------------------------------

describe("newId", () => {
  test("returns a string of length 36", () => {
    expect(newId()).toHaveLength(36);
  });

  test("has the correct UUIDv7 version nibble (7)", () => {
    const id = newId();
    // UUIDv7 format: xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx
    //                                ^--- version nibble at index 14
    expect(id[14]).toBe("7");
  });

  test("has the correct variant bits (8, 9, a, or b)", () => {
    const id = newId();
    // Variant bits are at index 19 (after the third hyphen)
    const variantNibble = id[19]?.toLowerCase();
    expect(["8", "9", "a", "b"]).toContain(variantNibble);
  });

  test("generates unique ids", () => {
    const ids = new Set(Array.from({ length: 100 }, () => newId()));
    expect(ids.size).toBe(100);
  });

  test("ids are monotonically sortable (later id sorts after earlier)", () => {
    const first = newId();
    // Small sleep isn't feasible in unit tests; instead verify lexicographic
    // order holds for two rapidly-generated ids (same-millisecond random seq).
    const second = newId();
    // Both should be valid UUIDs; first <= second in string order.
    expect(first <= second).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Advisory lock constant
// ---------------------------------------------------------------------------

describe("MIGRATION_LOCK_ID", () => {
  test("is a bigint", () => {
    expect(typeof MIGRATION_LOCK_ID).toBe("bigint");
  });

  test("fits within a signed 64-bit integer range", () => {
    const MAX_INT64 = BigInt("9223372036854775807");
    const MIN_INT64 = BigInt("-9223372036854775808");
    expect(MIGRATION_LOCK_ID >= MIN_INT64 && MIGRATION_LOCK_ID <= MAX_INT64).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Canonical seed tags
// ---------------------------------------------------------------------------

describe("CANONICAL_TAGS", () => {
  test("contains all expected cuisine tags", () => {
    const names = CANONICAL_TAGS.map((t) => t.name);
    expect(names).toContain("asian");
    expect(names).toContain("western");
    expect(names).toContain("italian");
  });

  test("contains all expected method tags", () => {
    const names = CANONICAL_TAGS.map((t) => t.name);
    expect(names).toContain("slow cooker");
    expect(names).toContain("one pot");
  });

  test("contains all expected meal_type tags", () => {
    const names = CANONICAL_TAGS.map((t) => t.name);
    expect(names).toContain("breakfast");
    expect(names).toContain("dinner");
    expect(names).toContain("dessert");
  });

  test("contains all expected practical tags", () => {
    const names = CANONICAL_TAGS.map((t) => t.name);
    expect(names).toContain("weeknight");
    expect(names).toContain("freezer friendly");
  });

  test("every entry has a non-empty name and category", () => {
    for (const tag of CANONICAL_TAGS) {
      expect(tag.name.length).toBeGreaterThan(0);
      expect(tag.category.length).toBeGreaterThan(0);
    }
  });

  test("has exactly 10 canonical entries", () => {
    expect(CANONICAL_TAGS).toHaveLength(10);
  });
});
