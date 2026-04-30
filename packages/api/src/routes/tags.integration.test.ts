import { beforeEach, describe, expect, test } from "bun:test";
import { app } from "../app";
import { CANONICAL_TAGS } from "../db/seed";
import { resetDb } from "./testHelpers";

// Only register tests when a real test database is available.
if (process.env.DATABASE_URL) {
  async function json(res: Response) {
    return res.json();
  }

  beforeEach(async () => {
    await resetDb();
  });

  describe("GET /api/tags", () => {
    test("returns the canonical seeded tags", async () => {
      const res = await app.fetch(new Request("http://localhost/api/tags"));
      expect(res.status).toBe(200);
      const data = await json(res);
      expect(data.tags.length).toBeGreaterThanOrEqual(CANONICAL_TAGS.length);
      const names = data.tags.map((t: { name: string }) => t.name);
      for (const canonical of CANONICAL_TAGS) {
        expect(names).toContain(canonical.name);
      }
    });
  });

  describe("POST /api/tags", () => {
    test("creates a new tag with lowercase name", async () => {
      const res = await app.fetch(
        new Request("http://localhost/api/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Vegan", category: "dietary" }),
        }),
      );
      expect(res.status).toBe(201);
      const data = await json(res);
      expect(data.tag.name).toBe("vegan");
      expect(data.tag.category).toBe("dietary");
      expect(data.tag.id).toBeTruthy();
    });

    test("returns the existing tag when name already exists (idempotent upsert)", async () => {
      const first = await app.fetch(
        new Request("http://localhost/api/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "gluten-free" }),
        }),
      );
      const firstData = await json(first);
      const originalId = firstData.tag.id;

      const second = await app.fetch(
        new Request("http://localhost/api/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "  Gluten-Free  " }),
        }),
      );
      expect(second.status).toBe(201);
      const secondData = await json(second);
      expect(secondData.tag.id).toBe(originalId);
      expect(secondData.tag.name).toBe("gluten-free");
    });
  });

  describe("DELETE /api/tags/:id", () => {
    test("removes the tag and cascades recipe_tags rows", async () => {
      const createTagRes = await app.fetch(
        new Request("http://localhost/api/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "tag-to-delete" }),
        }),
      );
      const tagData = await json(createTagRes);
      const tagId = tagData.tag.id;

      const createRecipeRes = await app.fetch(
        new Request("http://localhost/api/recipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Recipe with deleted tag",
            baseServings: 2,
            instructions: [],
            favourite: false,
            ingredients: [],
            tagIds: [tagId],
          }),
        }),
      );
      const recipeData = await json(createRecipeRes);
      const recipeId = recipeData.recipe.id;

      const deleteRes = await app.fetch(
        new Request(`http://localhost/api/tags/${tagId}`, { method: "DELETE" }),
      );
      expect(deleteRes.status).toBe(204);

      const listRes = await app.fetch(new Request("http://localhost/api/tags"));
      const listData = await json(listRes);
      expect(listData.tags.find((t: { id: string }) => t.id === tagId)).toBeUndefined();

      const recipeRes = await app.fetch(new Request(`http://localhost/api/recipes/${recipeId}`));
      const recipeBody = await json(recipeRes);
      expect(recipeBody.recipe.tagIds).not.toContain(tagId);
    });
  });
}
