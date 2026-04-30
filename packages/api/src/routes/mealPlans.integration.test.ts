import { beforeEach, describe, expect, test } from "bun:test";
import { app } from "../app";
import { resetDb } from "./testHelpers";

// Only register tests when a real test database is available.
if (process.env.DATABASE_URL) {
  async function json(res: Response) {
    return res.json();
  }

  async function createRecipe(title: string) {
    const res = await app.fetch(
      new Request("http://localhost/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          baseServings: 2,
          instructions: [],
          favourite: false,
          ingredients: [],
          tagIds: [],
        }),
      }),
    );
    const data = await json(res);
    return data.recipe as { id: string; title: string; imageUrl: string | null };
  }

  async function createPlan(name?: string) {
    const res = await app.fetch(
      new Request("http://localhost/api/meal-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name ?? null }),
      }),
    );
    expect(res.status).toBe(201);
    const data = await json(res);
    return data.mealPlan as { id: string; name: string | null; is_active: boolean };
  }

  beforeEach(async () => {
    await resetDb();
  });

  describe("POST /api/meal-plans", () => {
    test("creates a plan and returns 201 with empty slots", async () => {
      const res = await app.fetch(
        new Request("http://localhost/api/meal-plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Week 1" }),
        }),
      );

      expect(res.status).toBe(201);
      const data = await json(res);
      expect(data.mealPlan.name).toBe("Week 1");
      expect(data.mealPlan.is_active).toBe(false);
      expect(data.mealPlan.slots).toBeDefined();
      expect(data.mealPlan.slots.mon).toBeNull();
      expect(data.mealPlan.slots.sun).toBeNull();
    });

    test("creates a plan with null name", async () => {
      const plan = await createPlan();
      expect(plan.name).toBeNull();
    });
  });

  describe("GET /api/meal-plans", () => {
    test("lists plans ordered by created_at DESC", async () => {
      await createPlan("First");
      await createPlan("Second");

      const res = await app.fetch(new Request("http://localhost/api/meal-plans"));
      expect(res.status).toBe(200);
      const data = await json(res);
      expect(data.mealPlans.length).toBeGreaterThanOrEqual(2);
      // Most recently created first
      expect(data.mealPlans[0].name).toBe("Second");
      expect(data.mealPlans[1].name).toBe("First");
    });
  });

  describe("GET /api/meal-plans/:id", () => {
    test("returns plan detail with all 7 day slots", async () => {
      const plan = await createPlan("Detail Plan");

      const res = await app.fetch(new Request(`http://localhost/api/meal-plans/${plan.id}`));
      expect(res.status).toBe(200);
      const data = await json(res);
      expect(data.mealPlan.id).toBe(plan.id);
      const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
      for (const day of days) {
        expect(data.mealPlan.slots[day]).toBeNull();
      }
    });

    test("returns 404 for unknown id", async () => {
      const res = await app.fetch(
        new Request("http://localhost/api/meal-plans/00000000-0000-0000-0000-000000000000"),
      );
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/meal-plans/:id", () => {
    test("renames the plan", async () => {
      const plan = await createPlan("Old Name");

      const res = await app.fetch(
        new Request(`http://localhost/api/meal-plans/${plan.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "New Name" }),
        }),
      );
      expect(res.status).toBe(200);
      const data = await json(res);
      expect(data.mealPlan.name).toBe("New Name");
    });

    test("returns 404 for unknown plan", async () => {
      const res = await app.fetch(
        new Request("http://localhost/api/meal-plans/00000000-0000-0000-0000-000000000000", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "x" }),
        }),
      );
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/meal-plans/:id", () => {
    test("deletes plan and returns 204", async () => {
      const plan = await createPlan("To Delete");

      const del = await app.fetch(
        new Request(`http://localhost/api/meal-plans/${plan.id}`, { method: "DELETE" }),
      );
      expect(del.status).toBe(204);

      const get = await app.fetch(new Request(`http://localhost/api/meal-plans/${plan.id}`));
      expect(get.status).toBe(404);
    });

    test("returns 404 for unknown plan", async () => {
      const res = await app.fetch(
        new Request("http://localhost/api/meal-plans/00000000-0000-0000-0000-000000000000", {
          method: "DELETE",
        }),
      );
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/meal-plans/:id/activate", () => {
    test("sets plan as active", async () => {
      const plan = await createPlan("Activate Me");
      expect(plan.is_active).toBe(false);

      const res = await app.fetch(
        new Request(`http://localhost/api/meal-plans/${plan.id}/activate`, { method: "POST" }),
      );
      expect(res.status).toBe(200);
      const data = await json(res);
      expect(data.mealPlan.is_active).toBe(true);
    });

    test("activating one plan clears the previously active plan", async () => {
      const plan1 = await createPlan("Plan 1");
      const plan2 = await createPlan("Plan 2");

      // Activate plan1 first
      await app.fetch(
        new Request(`http://localhost/api/meal-plans/${plan1.id}/activate`, { method: "POST" }),
      );

      // Now activate plan2
      await app.fetch(
        new Request(`http://localhost/api/meal-plans/${plan2.id}/activate`, { method: "POST" }),
      );

      // plan1 should no longer be active
      const get1 = await app.fetch(new Request(`http://localhost/api/meal-plans/${plan1.id}`));
      const data1 = await json(get1);
      expect(data1.mealPlan.is_active).toBe(false);

      // plan2 should be active
      const get2 = await app.fetch(new Request(`http://localhost/api/meal-plans/${plan2.id}`));
      const data2 = await json(get2);
      expect(data2.mealPlan.is_active).toBe(true);
    });

    test("returns 404 for unknown plan", async () => {
      const res = await app.fetch(
        new Request(
          "http://localhost/api/meal-plans/00000000-0000-0000-0000-000000000000/activate",
          {
            method: "POST",
          },
        ),
      );
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/meal-plans/:id/slots/:day", () => {
    test("upserts a slot with recipe_id and returns inline recipe fields", async () => {
      const plan = await createPlan("Slots Plan");
      const recipe = await createRecipe("Pasta Bake");

      const res = await app.fetch(
        new Request(`http://localhost/api/meal-plans/${plan.id}/slots/mon`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipe_id: recipe.id }),
        }),
      );
      expect(res.status).toBe(200);
      const data = await json(res);
      expect(data.mealPlan.slots.mon).not.toBeNull();
      expect(data.mealPlan.slots.mon.recipe_id).toBe(recipe.id);
      expect(data.mealPlan.slots.mon.recipe_title).toBe("Pasta Bake");
    });

    test("replaces recipe slot with note on same day", async () => {
      const plan = await createPlan("Replace Test");
      const recipe = await createRecipe("Stir Fry");

      // First set recipe
      await app.fetch(
        new Request(`http://localhost/api/meal-plans/${plan.id}/slots/tue`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipe_id: recipe.id }),
        }),
      );

      // Then replace with note
      const res = await app.fetch(
        new Request(`http://localhost/api/meal-plans/${plan.id}/slots/tue`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: "Takeaway night" }),
        }),
      );
      expect(res.status).toBe(200);
      const data = await json(res);
      expect(data.mealPlan.slots.tue.recipe_id).toBeNull();
      expect(data.mealPlan.slots.tue.note).toBe("Takeaway night");
    });

    test("clears a slot when both recipe_id and note are null", async () => {
      const plan = await createPlan("Clear Test");
      const recipe = await createRecipe("Soup");

      // Set a recipe first
      await app.fetch(
        new Request(`http://localhost/api/meal-plans/${plan.id}/slots/wed`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipe_id: recipe.id }),
        }),
      );

      // Clear it
      const res = await app.fetch(
        new Request(`http://localhost/api/meal-plans/${plan.id}/slots/wed`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipe_id: null, note: null }),
        }),
      );
      expect(res.status).toBe(200);
      const data = await json(res);
      // Slot cleared — recipe_id and note should be null
      expect(data.mealPlan.slots.wed?.recipe_id).toBeNull();
      expect(data.mealPlan.slots.wed?.note).toBeNull();
    });

    test("returns 400 for invalid day", async () => {
      const plan = await createPlan("Bad Day");

      const res = await app.fetch(
        new Request(`http://localhost/api/meal-plans/${plan.id}/slots/monday`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }),
      );
      expect(res.status).toBe(400);
    });

    test("returns 404 for unknown plan", async () => {
      const res = await app.fetch(
        new Request(
          "http://localhost/api/meal-plans/00000000-0000-0000-0000-000000000000/slots/mon",
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          },
        ),
      );
      expect(res.status).toBe(404);
    });

    test("CRUD lifecycle: create → rename → activate → delete", async () => {
      // Create
      const plan = await createPlan("My Week");
      expect(plan.name).toBe("My Week");

      // Rename
      const patchRes = await app.fetch(
        new Request(`http://localhost/api/meal-plans/${plan.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Week of 28 Apr" }),
        }),
      );
      const renamed = await json(patchRes);
      expect(renamed.mealPlan.name).toBe("Week of 28 Apr");

      // Activate
      const activateRes = await app.fetch(
        new Request(`http://localhost/api/meal-plans/${plan.id}/activate`, { method: "POST" }),
      );
      const activated = await json(activateRes);
      expect(activated.mealPlan.is_active).toBe(true);

      // Delete
      const delRes = await app.fetch(
        new Request(`http://localhost/api/meal-plans/${plan.id}`, { method: "DELETE" }),
      );
      expect(delRes.status).toBe(204);

      // Confirm gone
      const getRes = await app.fetch(new Request(`http://localhost/api/meal-plans/${plan.id}`));
      expect(getRes.status).toBe(404);
    });
  });
}
