import { beforeEach, describe, expect, test } from "bun:test";
import { asc } from "drizzle-orm";
import { app } from "../app";
import { tags as tagsTable } from "../db/schema";
import { resetDb, testDb } from "./testHelpers";

// Only register tests when a real test database is available.
// Without DATABASE_URL plain `bun test` skips this file gracefully.
if (process.env.DATABASE_URL) {
  async function getSeededTags() {
    return testDb.select().from(tagsTable).orderBy(asc(tagsTable.name));
  }

  async function json(res: Response) {
    return res.json();
  }

  beforeEach(async () => {
    await resetDb();
  });

  describe("POST /api/recipes", () => {
    test("creates a recipe and returns 201 with the full recipe", async () => {
      const allTags = await getSeededTags();
      const tagIds = [allTags[0].id, allTags[1].id];

      const body = {
        title: "Test French Toast",
        description: "A classic breakfast",
        baseServings: 4,
        instructions: ["Dip bread", "Fry in butter"],
        favourite: false,
        ingredients: [
          {
            item: "bread",
            originalLine: "2 slices bread",
            quantity: 2,
            unit: "slices",
            displayOrder: 0,
          },
          {
            item: "egg",
            originalLine: "1 large egg",
            quantity: 1,
            displayOrder: 1,
          },
        ],
        tagIds,
      };

      const res = await app.fetch(
        new Request("http://localhost/api/recipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );

      expect(res.status).toBe(201);
      const data = await json(res);
      expect(data.recipe.title).toBe("Test French Toast");
      expect(data.recipe.baseServings).toBe(4);
      expect(data.recipe.ingredients).toHaveLength(2);
      expect(data.recipe.ingredients[0].id).toBeTruthy();
      expect(data.recipe.ingredients[0].displayOrder).toBe(0);
      expect(data.recipe.ingredients[1].displayOrder).toBe(1);
      expect(data.recipe.tagIds.sort()).toEqual(tagIds.sort());
    });
  });

  describe("GET /api/recipes", () => {
    test("returns all recipes in the list", async () => {
      const allTags = await getSeededTags();
      const tagId = allTags[0].id;

      await app.fetch(
        new Request("http://localhost/api/recipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Pasta Carbonara",
            baseServings: 2,
            instructions: ["Cook pasta"],
            favourite: false,
            ingredients: [],
            tagIds: [tagId],
          }),
        }),
      );

      const res = await app.fetch(new Request("http://localhost/api/recipes"));
      expect(res.status).toBe(200);
      const data = await json(res);
      expect(data.recipes.length).toBeGreaterThanOrEqual(1);
      const found = data.recipes.find((r: { title: string }) => r.title === "Pasta Carbonara");
      expect(found).toBeTruthy();
      expect(found.tagIds).toContain(tagId);
    });

    test("filters by title/description with ?q=", async () => {
      await app.fetch(
        new Request("http://localhost/api/recipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Unique Soup Recipe",
            baseServings: 2,
            instructions: [],
            favourite: false,
            ingredients: [],
            tagIds: [],
          }),
        }),
      );
      await app.fetch(
        new Request("http://localhost/api/recipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Chocolate Cake",
            baseServings: 8,
            instructions: [],
            favourite: false,
            ingredients: [],
            tagIds: [],
          }),
        }),
      );

      const res = await app.fetch(new Request("http://localhost/api/recipes?q=unique+soup"));
      const data = await json(res);
      expect(data.recipes.length).toBe(1);
      expect(data.recipes[0].title).toBe("Unique Soup Recipe");
    });

    test("filters by tag ids (AND semantics)", async () => {
      const allTags = await getSeededTags();
      const tag1 = allTags[0].id;
      const tag2 = allTags[1].id;
      const tag3 = allTags[2].id;

      await app.fetch(
        new Request("http://localhost/api/recipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Both Tags Recipe",
            baseServings: 2,
            instructions: [],
            favourite: false,
            ingredients: [],
            tagIds: [tag1, tag2],
          }),
        }),
      );

      await app.fetch(
        new Request("http://localhost/api/recipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Single Tag Recipe",
            baseServings: 2,
            instructions: [],
            favourite: false,
            ingredients: [],
            tagIds: [tag3],
          }),
        }),
      );

      const res = await app.fetch(
        new Request(`http://localhost/api/recipes?tag=${tag1}&tag=${tag2}`),
      );
      const data = await json(res);
      expect(
        data.recipes.every(
          (r: { tagIds: string[] }) => r.tagIds.includes(tag1) && r.tagIds.includes(tag2),
        ),
      ).toBe(true);
      expect(
        data.recipes.find((r: { title: string }) => r.title === "Both Tags Recipe"),
      ).toBeTruthy();
      expect(
        data.recipes.find((r: { title: string }) => r.title === "Single Tag Recipe"),
      ).toBeFalsy();
    });

    test("filters by favourite=true", async () => {
      await app.fetch(
        new Request("http://localhost/api/recipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Favourite Recipe",
            baseServings: 2,
            instructions: [],
            favourite: true,
            ingredients: [],
            tagIds: [],
          }),
        }),
      );
      await app.fetch(
        new Request("http://localhost/api/recipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Non-Favourite Recipe",
            baseServings: 2,
            instructions: [],
            favourite: false,
            ingredients: [],
            tagIds: [],
          }),
        }),
      );

      const res = await app.fetch(new Request("http://localhost/api/recipes?favourite=true"));
      const data = await json(res);
      expect(data.recipes.every((r: { favourite: boolean }) => r.favourite === true)).toBe(true);
      expect(
        data.recipes.find((r: { title: string }) => r.title === "Favourite Recipe"),
      ).toBeTruthy();
      expect(
        data.recipes.find((r: { title: string }) => r.title === "Non-Favourite Recipe"),
      ).toBeFalsy();
    });
  });

  describe("GET /api/recipes/:id", () => {
    test("returns ingredients ordered by displayOrder and full tagIds", async () => {
      const allTags = await getSeededTags();
      const tagId = allTags[0].id;

      const createRes = await app.fetch(
        new Request("http://localhost/api/recipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Ordered Ingredients Recipe",
            baseServings: 2,
            instructions: ["Step 1"],
            favourite: false,
            ingredients: [
              { item: "flour", originalLine: "2 cups flour", displayOrder: 1 },
              { item: "sugar", originalLine: "1 tbsp sugar", displayOrder: 0 },
            ],
            tagIds: [tagId],
          }),
        }),
      );
      const created = await json(createRes);
      const id = created.recipe.id;

      const res = await app.fetch(new Request(`http://localhost/api/recipes/${id}`));
      expect(res.status).toBe(200);
      const data = await json(res);
      expect(data.recipe.ingredients[0].item).toBe("sugar");
      expect(data.recipe.ingredients[0].displayOrder).toBe(0);
      expect(data.recipe.ingredients[1].item).toBe("flour");
      expect(data.recipe.ingredients[1].displayOrder).toBe(1);
      expect(data.recipe.tagIds).toContain(tagId);
    });
  });

  describe("PUT /api/recipes/:id", () => {
    test("replaces ingredients and tags atomically; subsequent GET reflects new state", async () => {
      const allTags = await getSeededTags();
      const oldTagId = allTags[0].id;
      const newTagId = allTags[1].id;

      const createRes = await app.fetch(
        new Request("http://localhost/api/recipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Original Title",
            baseServings: 2,
            instructions: [],
            favourite: false,
            ingredients: [
              { item: "old ingredient", originalLine: "old ingredient", displayOrder: 0 },
            ],
            tagIds: [oldTagId],
          }),
        }),
      );
      const created = await json(createRes);
      const id = created.recipe.id;

      const updateRes = await app.fetch(
        new Request(`http://localhost/api/recipes/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Updated Title",
            baseServings: 4,
            instructions: ["New step"],
            favourite: true,
            ingredients: [
              { item: "new ingredient", originalLine: "new ingredient", displayOrder: 0 },
            ],
            tagIds: [newTagId],
          }),
        }),
      );
      expect(updateRes.status).toBe(200);

      const getRes = await app.fetch(new Request(`http://localhost/api/recipes/${id}`));
      const data = await json(getRes);
      expect(data.recipe.title).toBe("Updated Title");
      expect(data.recipe.baseServings).toBe(4);
      expect(data.recipe.favourite).toBe(true);
      expect(data.recipe.ingredients).toHaveLength(1);
      expect(data.recipe.ingredients[0].item).toBe("new ingredient");
      expect(
        data.recipe.ingredients.find((i: { item: string }) => i.item === "old ingredient"),
      ).toBeUndefined();
      expect(data.recipe.tagIds).toEqual([newTagId]);
      expect(data.recipe.tagIds).not.toContain(oldTagId);
    });
  });

  describe("POST /api/recipes/:id/favourite", () => {
    test("toggles the favourite flag", async () => {
      const createRes = await app.fetch(
        new Request("http://localhost/api/recipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Toggle Me",
            baseServings: 1,
            instructions: [],
            favourite: false,
            ingredients: [],
            tagIds: [],
          }),
        }),
      );
      const created = await json(createRes);
      const id = created.recipe.id;
      expect(created.recipe.favourite).toBe(false);

      const toggleRes = await app.fetch(
        new Request(`http://localhost/api/recipes/${id}/favourite`, { method: "POST" }),
      );
      expect(toggleRes.status).toBe(200);
      const toggled = await json(toggleRes);
      expect(toggled.recipe.favourite).toBe(true);

      const toggle2Res = await app.fetch(
        new Request(`http://localhost/api/recipes/${id}/favourite`, { method: "POST" }),
      );
      const toggled2 = await json(toggle2Res);
      expect(toggled2.recipe.favourite).toBe(false);
    });
  });

  describe("DELETE /api/recipes/:id", () => {
    test("returns 204 and cascades deletion of ingredients and recipe_tags", async () => {
      const allTags = await getSeededTags();
      const tagId = allTags[0].id;

      const createRes = await app.fetch(
        new Request("http://localhost/api/recipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Delete Me",
            baseServings: 2,
            instructions: [],
            favourite: false,
            ingredients: [{ item: "thing", originalLine: "1 thing", displayOrder: 0 }],
            tagIds: [tagId],
          }),
        }),
      );
      const created = await json(createRes);
      const id = created.recipe.id;

      const deleteRes = await app.fetch(
        new Request(`http://localhost/api/recipes/${id}`, { method: "DELETE" }),
      );
      expect(deleteRes.status).toBe(204);

      const getRes = await app.fetch(new Request(`http://localhost/api/recipes/${id}`));
      expect(getRes.status).toBe(404);
    });
  });
}
