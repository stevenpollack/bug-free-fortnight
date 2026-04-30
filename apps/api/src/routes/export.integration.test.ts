import { beforeEach, describe, expect, test } from "bun:test";
import { app } from "../app";
import { resetDb } from "./testHelpers";

// Only register tests when a real test database is available.
if (process.env.DATABASE_URL) {
  async function json(res: Response) {
    return res.json();
  }

  beforeEach(async () => {
    await resetDb();
  });

  describe("GET /api/export", () => {
    test("returns exportedAt, recipes with ingredients and full tag objects, and tags", async () => {
      const tagsRes = await app.fetch(new Request("http://localhost/api/tags"));
      const tagsData = await json(tagsRes);
      const tagId = tagsData.tags[0].id;
      const tagName = tagsData.tags[0].name;

      await app.fetch(
        new Request("http://localhost/api/recipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Export Test Recipe",
            description: "For export test",
            baseServings: 4,
            instructions: ["Mix", "Bake"],
            favourite: false,
            ingredients: [
              {
                item: "flour",
                originalLine: "2 cups flour",
                quantity: 2,
                unit: "cups",
                displayOrder: 0,
              },
            ],
            tagIds: [tagId],
          }),
        }),
      );

      const res = await app.fetch(new Request("http://localhost/api/export"));
      expect(res.status).toBe(200);
      const data = await json(res);

      expect(typeof data.exportedAt).toBe("string");
      expect(new Date(data.exportedAt).toISOString()).toBe(data.exportedAt);

      expect(Array.isArray(data.tags)).toBe(true);
      expect(data.tags.length).toBeGreaterThanOrEqual(1);

      expect(Array.isArray(data.recipes)).toBe(true);
      const exported = data.recipes.find(
        (r: { title: string }) => r.title === "Export Test Recipe",
      );
      expect(exported).toBeTruthy();

      expect(exported.ingredients).toHaveLength(1);
      expect(exported.ingredients[0].item).toBe("flour");

      expect(Array.isArray(exported.tags)).toBe(true);
      const exportedTag = exported.tags.find((t: { id: string }) => t.id === tagId);
      expect(exportedTag).toBeTruthy();
      expect(exportedTag.name).toBe(tagName);
    });

    test("reflects current database state — empty recipes list when no recipes exist", async () => {
      const res = await app.fetch(new Request("http://localhost/api/export"));
      const data = await json(res);
      expect(data.recipes).toHaveLength(0);
      expect(data.tags.length).toBeGreaterThanOrEqual(1);
    });
  });
}
