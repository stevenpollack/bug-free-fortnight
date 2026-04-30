import { beforeEach, describe, expect, test } from "bun:test";
import { app } from "../app";
import { resetDb } from "./testHelpers";

// Only register tests when a real test database is available.
if (process.env.DATABASE_URL) {
  async function json(res: Response) {
    return res.json();
  }

  async function createRecipe(
    title: string,
    ingredients: Array<{
      item: string;
      quantity?: number | null;
      unit?: string | null;
    }>,
  ) {
    const res = await app.fetch(
      new Request("http://localhost/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          baseServings: 2,
          instructions: [],
          favourite: false,
          ingredients: ingredients.map((ing, idx) => ({
            item: ing.item,
            quantity: ing.quantity ?? null,
            unit: ing.unit ?? null,
            displayOrder: idx,
            originalLine: ing.item,
          })),
          tagIds: [],
        }),
      }),
    );
    const data = await json(res);
    return data.recipe as { id: string; title: string };
  }

  async function createPlan(name?: string) {
    const res = await app.fetch(
      new Request("http://localhost/api/meal-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name ?? null }),
      }),
    );
    const data = await json(res);
    return data.mealPlan as { id: string; name: string | null; updated_at: string };
  }

  async function setSlot(planId: string, day: string, recipeId: string | null) {
    const res = await app.fetch(
      new Request(`http://localhost/api/meal-plans/${planId}/slots/${day}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe_id: recipeId }),
      }),
    );
    return json(res);
  }

  async function generateList(planId: string) {
    const res = await app.fetch(
      new Request(`http://localhost/api/meal-plans/${planId}/shopping-list/generate`, {
        method: "POST",
      }),
    );
    return { res, data: await json(res) };
  }

  async function getList(planId: string) {
    const res = await app.fetch(
      new Request(`http://localhost/api/meal-plans/${planId}/shopping-list`),
    );
    return { res, data: await json(res) };
  }

  beforeEach(async () => {
    await resetDb();
  });

  describe("POST /api/meal-plans/:id/shopping-list/generate", () => {
    test("returns 404 for unknown plan", async () => {
      const res = await app.fetch(
        new Request(
          "http://localhost/api/meal-plans/00000000-0000-0000-0000-000000000000/shopping-list/generate",
          { method: "POST" },
        ),
      );
      expect(res.status).toBe(404);
    });

    test("generates empty list when no slots have recipes", async () => {
      const plan = await createPlan("Empty Plan");
      const { res, data } = await generateList(plan.id);

      expect(res.status).toBe(201);
      expect(data.shoppingList).not.toBeNull();
      expect(data.shoppingList.items).toHaveLength(0);
      expect(data.shoppingList.plan_id).toBe(plan.id);
    });

    test("generates list from single recipe slot", async () => {
      const recipe = await createRecipe("Pasta", [
        { item: "spaghetti", quantity: 200, unit: "g" },
        { item: "tomatoes", quantity: 4, unit: null },
      ]);
      const plan = await createPlan("Pasta Week");
      await setSlot(plan.id, "mon", recipe.id);

      const { res, data } = await generateList(plan.id);

      expect(res.status).toBe(201);
      expect(data.shoppingList.items).toHaveLength(2);

      const items = data.shoppingList.items as Array<{
        item: string;
        quantity: number | null;
        unit: string | null;
        checked: boolean;
        custom: boolean;
      }>;
      // Items are sorted alphabetically
      expect(items[0].item).toBe("spaghetti");
      expect(items[0].quantity).toBe(200);
      expect(items[0].unit).toBe("g");
      expect(items[0].checked).toBe(false);
      expect(items[0].custom).toBe(false);
      expect(items[1].item).toBe("tomatoes");
      expect(items[1].quantity).toBe(4);
      expect(items[1].unit).toBeNull();
    });

    test("consolidates same ingredient across different days", async () => {
      const recipe = await createRecipe("Pasta", [
        { item: "Flour", quantity: 100, unit: "g" },
        { item: "eggs", quantity: 2, unit: null },
      ]);
      const plan = await createPlan("Double Pasta");
      await setSlot(plan.id, "mon", recipe.id);
      await setSlot(plan.id, "wed", recipe.id);

      const { data } = await generateList(plan.id);

      const items = data.shoppingList.items as Array<{
        item: string;
        quantity: number | null;
        unit: string | null;
      }>;
      expect(items).toHaveLength(2);

      const flour = items.find((i) => i.item.toLowerCase() === "flour");
      expect(flour).toBeDefined();
      expect(flour?.quantity).toBe(200); // 100 * 2 occurrences

      // eggs has null-safe: both non-null so summed
      const eggs = items.find((i) => i.item === "eggs");
      expect(eggs?.quantity).toBe(4); // 2 * 2
    });

    test("quantity becomes null when either side is null during consolidation", async () => {
      const recipe1 = await createRecipe("R1", [{ item: "butter", quantity: 50, unit: "g" }]);
      const recipe2 = await createRecipe("R2", [{ item: "butter", quantity: null, unit: "g" }]);
      const plan = await createPlan("Null Qty Plan");
      await setSlot(plan.id, "mon", recipe1.id);
      await setSlot(plan.id, "tue", recipe2.id);

      const { data } = await generateList(plan.id);

      const items = data.shoppingList.items as Array<{
        item: string;
        quantity: number | null;
        unit: string | null;
      }>;
      const butter = items.find((i) => i.item === "butter");
      expect(butter).toBeDefined();
      expect(butter?.quantity).toBeNull();
    });

    test("items sorted alphabetically by item name", async () => {
      const recipe = await createRecipe("Mixed", [
        { item: "zucchini", quantity: 1, unit: null },
        { item: "apple", quantity: 2, unit: null },
        { item: "mango", quantity: 3, unit: null },
      ]);
      const plan = await createPlan("Sorted Plan");
      await setSlot(plan.id, "mon", recipe.id);

      const { data } = await generateList(plan.id);
      const items = data.shoppingList.items as Array<{ item: string }>;
      expect(items.map((i) => i.item)).toEqual(["apple", "mango", "zucchini"]);
    });

    test("regenerating replaces the old list", async () => {
      const recipe = await createRecipe("R", [{ item: "onion", quantity: 1, unit: null }]);
      const plan = await createPlan("Regen Plan");
      await setSlot(plan.id, "mon", recipe.id);

      const { data: first } = await generateList(plan.id);
      const firstId = first.shoppingList.id;

      const { data: second } = await generateList(plan.id);
      expect(second.shoppingList.id).not.toBe(firstId);

      // Old list should be gone — verify via GET
      const { data: got } = await getList(plan.id);
      expect(got.shoppingList.id).toBe(second.shoppingList.id);
    });
  });

  describe("GET /api/meal-plans/:id/shopping-list", () => {
    test("returns null shoppingList before generation", async () => {
      const plan = await createPlan("No List");
      const { res, data } = await getList(plan.id);

      expect(res.status).toBe(200);
      expect(data.shoppingList).toBeNull();
      expect(data.plan_updated_at).toBeDefined();
    });

    test("returns list after generation with plan_updated_at", async () => {
      const recipe = await createRecipe("Soup", [{ item: "carrots", quantity: 3, unit: null }]);
      const plan = await createPlan("Soup Plan");
      await setSlot(plan.id, "fri", recipe.id);
      await generateList(plan.id);

      const { res, data } = await getList(plan.id);
      expect(res.status).toBe(200);
      expect(data.shoppingList).not.toBeNull();
      expect(data.shoppingList.items).toHaveLength(1);
      expect(data.plan_updated_at).toBeDefined();
    });

    test("staleness: plan_updated_at > plan_snapshot_at after slot change", async () => {
      const recipe = await createRecipe("Stew", [{ item: "potato", quantity: 3, unit: null }]);
      const plan = await createPlan("Stale Plan");
      await setSlot(plan.id, "mon", recipe.id);
      await generateList(plan.id);

      // Change a slot — bumps updatedAt
      await setSlot(plan.id, "tue", recipe.id);

      const { data } = await getList(plan.id);
      expect(data.shoppingList).not.toBeNull();
      const snapshotAt = new Date(data.shoppingList.plan_snapshot_at).getTime();
      const updatedAt = new Date(data.plan_updated_at).getTime();
      expect(updatedAt).toBeGreaterThan(snapshotAt);
    });

    test("returns 404 for unknown plan", async () => {
      const res = await app.fetch(
        new Request(
          "http://localhost/api/meal-plans/00000000-0000-0000-0000-000000000000/shopping-list",
        ),
      );
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/meal-plans/:id/shopping-list/items/:itemId", () => {
    test("toggles checked state", async () => {
      const recipe = await createRecipe("Toast", [{ item: "bread", quantity: 4, unit: "slices" }]);
      const plan = await createPlan("Toast Plan");
      await setSlot(plan.id, "mon", recipe.id);
      const { data: genData } = await generateList(plan.id);

      const itemId = genData.shoppingList.items[0].id;

      const res = await app.fetch(
        new Request(`http://localhost/api/meal-plans/${plan.id}/shopping-list/items/${itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checked: true }),
        }),
      );
      expect(res.status).toBe(200);
      const data = await json(res);
      expect(data.item.checked).toBe(true);
    });

    test("edits item text and quantity", async () => {
      const recipe = await createRecipe("Salad", [{ item: "lettuce", quantity: 1, unit: "head" }]);
      const plan = await createPlan("Salad Plan");
      await setSlot(plan.id, "mon", recipe.id);
      const { data: genData } = await generateList(plan.id);

      const itemId = genData.shoppingList.items[0].id;

      const res = await app.fetch(
        new Request(`http://localhost/api/meal-plans/${plan.id}/shopping-list/items/${itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item: "romaine lettuce", quantity: 2 }),
        }),
      );
      const data = await json(res);
      expect(data.item.item).toBe("romaine lettuce");
      expect(data.item.quantity).toBe(2);
    });

    test("returns 404 for unknown item", async () => {
      const plan = await createPlan("404 Plan");
      await generateList(plan.id);

      const res = await app.fetch(
        new Request(
          `http://localhost/api/meal-plans/${plan.id}/shopping-list/items/00000000-0000-0000-0000-000000000000`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ checked: true }),
          },
        ),
      );
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/meal-plans/:id/shopping-list/items/:itemId", () => {
    test("deletes item and returns 204", async () => {
      const recipe = await createRecipe("Omelette", [
        { item: "eggs", quantity: 3, unit: null },
        { item: "cheese", quantity: 50, unit: "g" },
      ]);
      const plan = await createPlan("Omelette Plan");
      await setSlot(plan.id, "mon", recipe.id);
      const { data: genData } = await generateList(plan.id);

      const itemId = genData.shoppingList.items[0].id;

      const del = await app.fetch(
        new Request(`http://localhost/api/meal-plans/${plan.id}/shopping-list/items/${itemId}`, {
          method: "DELETE",
        }),
      );
      expect(del.status).toBe(204);

      // Verify item is gone
      const { data } = await getList(plan.id);
      const remaining = data.shoppingList.items as Array<{ id: string }>;
      expect(remaining.find((i) => i.id === itemId)).toBeUndefined();
    });

    test("returns 404 for unknown item", async () => {
      const plan = await createPlan("Del 404");
      await generateList(plan.id);

      const res = await app.fetch(
        new Request(
          `http://localhost/api/meal-plans/${plan.id}/shopping-list/items/00000000-0000-0000-0000-000000000000`,
          { method: "DELETE" },
        ),
      );
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/meal-plans/:id/shopping-list/items", () => {
    test("adds custom item to an existing list", async () => {
      const plan = await createPlan("Custom Plan");
      await generateList(plan.id); // generate empty list

      const res = await app.fetch(
        new Request(`http://localhost/api/meal-plans/${plan.id}/shopping-list/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item: "sparkling water", quantity: 2, unit: "bottles" }),
        }),
      );
      expect(res.status).toBe(201);
      const data = await json(res);
      expect(data.item.item).toBe("sparkling water");
      expect(data.item.quantity).toBe(2);
      expect(data.item.unit).toBe("bottles");
      expect(data.item.custom).toBe(true);
      expect(data.item.checked).toBe(false);
    });

    test("returns 404 when list not yet generated", async () => {
      const plan = await createPlan("No List Plan");

      const res = await app.fetch(
        new Request(`http://localhost/api/meal-plans/${plan.id}/shopping-list/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item: "water" }),
        }),
      );
      expect(res.status).toBe(404);
    });

    test("custom item appears in GET list", async () => {
      const plan = await createPlan("Visible Custom");
      await generateList(plan.id);

      await app.fetch(
        new Request(`http://localhost/api/meal-plans/${plan.id}/shopping-list/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item: "chocolate" }),
        }),
      );

      const { data } = await getList(plan.id);
      const items = data.shoppingList.items as Array<{ item: string; custom: boolean }>;
      const choc = items.find((i) => i.item === "chocolate");
      expect(choc).toBeDefined();
      expect(choc?.custom).toBe(true);
    });
  });

  describe("full CRUD lifecycle", () => {
    test("generate → check item → add custom → delete custom → regenerate", async () => {
      const recipe = await createRecipe("Pancakes", [
        { item: "flour", quantity: 200, unit: "g" },
        { item: "milk", quantity: 300, unit: "ml" },
      ]);
      const plan = await createPlan("Lifecycle Plan");
      await setSlot(plan.id, "sat", recipe.id);

      // Generate
      const { data: gen } = await generateList(plan.id);
      expect(gen.shoppingList.items).toHaveLength(2);

      const flourItem = gen.shoppingList.items.find((i: { item: string }) => i.item === "flour");
      expect(flourItem).toBeDefined();

      // Check flour
      const patchRes = await app.fetch(
        new Request(
          `http://localhost/api/meal-plans/${plan.id}/shopping-list/items/${flourItem.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ checked: true }),
          },
        ),
      );
      expect(patchRes.status).toBe(200);

      // Add custom item
      const addRes = await app.fetch(
        new Request(`http://localhost/api/meal-plans/${plan.id}/shopping-list/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item: "syrup" }),
        }),
      );
      const addData = await json(addRes);
      const syrupId = addData.item.id;

      // Delete custom item
      const delRes = await app.fetch(
        new Request(`http://localhost/api/meal-plans/${plan.id}/shopping-list/items/${syrupId}`, {
          method: "DELETE",
        }),
      );
      expect(delRes.status).toBe(204);

      // Regenerate — replaces entire list
      const { data: regen } = await generateList(plan.id);
      expect(regen.shoppingList.items).toHaveLength(2);
      // Regenerated items are not checked
      for (const item of regen.shoppingList.items) {
        expect(item.checked).toBe(false);
      }
    });
  });
}
