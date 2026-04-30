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
    expect(res.status).toBe(201);
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
    expect(res.status).toBe(201);
    const data = await json(res);
    return data.mealPlan as { id: string; name: string | null };
  }

  async function getPlan(id: string) {
    const res = await app.fetch(new Request(`http://localhost/api/meal-plans/${id}`));
    expect(res.status).toBe(200);
    const data = await json(res);
    return data.mealPlan as {
      id: string;
      slots: Record<string, { recipe_id: string | null; recipe_title: string | null } | null>;
    };
  }

  beforeEach(async () => {
    await resetDb();
  });

  // ---------------------------------------------------------------------------
  // GET /api/schemas/meal-plan
  // ---------------------------------------------------------------------------

  describe("GET /api/schemas/meal-plan", () => {
    test("returns a JSON Schema object", async () => {
      const res = await app.fetch(new Request("http://localhost/api/schemas/meal-plan"));
      expect(res.status).toBe(200);
      const data = await json(res);
      expect(data).toHaveProperty("type");
      expect(data).toHaveProperty("properties");
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/meal-plans/generate (rawJson path)
  // ---------------------------------------------------------------------------

  describe("POST /api/meal-plans/generate — rawJson path", () => {
    test("applies existing slot when recipeId is valid", async () => {
      const recipe = await createRecipe("Pasta Carbonara");
      const plan = await createPlan("Test Week");

      const payload = {
        planId: plan.id,
        rawJson: JSON.stringify({
          slots: [{ type: "existing", day: "mon", recipeId: recipe.id }],
        }),
      };

      const res = await app.fetch(
        new Request("http://localhost/api/meal-plans/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      );

      expect(res.status).toBe(200);
      const data = await json(res);
      expect(data.ok).toBe(true);
      expect(data.slotCount).toBe(1);

      const updated = await getPlan(plan.id);
      expect(updated.slots.mon?.recipe_id).toBe(recipe.id);
    });

    test("creates new recipe and assigns slot when type=new", async () => {
      const plan = await createPlan("New Recipe Week");

      const newRecipe = {
        title: "AI Chicken Stir Fry",
        baseServings: 4,
        instructions: ["Heat oil", "Stir fry chicken"],
        favourite: false,
        ingredients: [
          { item: "chicken breast", quantity: 500, unit: "g", originalLine: "500g chicken breast" },
        ],
        tagIds: [],
      };

      const payload = {
        planId: plan.id,
        rawJson: JSON.stringify({
          slots: [{ type: "new", day: "tue", recipe: newRecipe }],
        }),
      };

      const res = await app.fetch(
        new Request("http://localhost/api/meal-plans/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      );

      expect(res.status).toBe(200);
      const data = await json(res);
      expect(data.ok).toBe(true);

      const updated = await getPlan(plan.id);
      expect(updated.slots.tue?.recipe_title).toBe("AI Chicken Stir Fry");
    });

    test("upserts slot when applied twice (no duplicate rows)", async () => {
      const recipe1 = await createRecipe("Recipe A");
      const recipe2 = await createRecipe("Recipe B");
      const plan = await createPlan("Upsert Test");

      // First generate
      await app.fetch(
        new Request("http://localhost/api/meal-plans/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId: plan.id,
            rawJson: JSON.stringify({
              slots: [{ type: "existing", day: "wed", recipeId: recipe1.id }],
            }),
          }),
        }),
      );

      // Second generate on same day
      const res = await app.fetch(
        new Request("http://localhost/api/meal-plans/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId: plan.id,
            rawJson: JSON.stringify({
              slots: [{ type: "existing", day: "wed", recipeId: recipe2.id }],
            }),
          }),
        }),
      );

      expect(res.status).toBe(200);
      const updated = await getPlan(plan.id);
      // Second recipe wins; no duplicate rows
      expect(updated.slots.wed?.recipe_id).toBe(recipe2.id);
    });

    test("returns 422 when LLM references an unknown recipeId", async () => {
      const plan = await createPlan("Invalid Ref Week");

      const payload = {
        planId: plan.id,
        rawJson: JSON.stringify({
          slots: [
            {
              type: "existing",
              day: "fri",
              recipeId: "00000000-0000-0000-0000-000000000000",
            },
          ],
        }),
      };

      const res = await app.fetch(
        new Request("http://localhost/api/meal-plans/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      );

      expect(res.status).toBe(422);
      const data = await json(res);
      expect(data.error.code).toBe("GENERATION_INVALID_REFERENCE");
    });

    test("returns 422 for invalid JSON in rawJson", async () => {
      const plan = await createPlan();

      const res = await app.fetch(
        new Request("http://localhost/api/meal-plans/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId: plan.id, rawJson: "not valid json{" }),
        }),
      );

      expect(res.status).toBe(422);
      const data = await json(res);
      expect(data.error.code).toBe("INVALID_JSON");
    });

    test("returns 422 when rawJson does not match LlmMealPlanOutput schema", async () => {
      const plan = await createPlan();

      const res = await app.fetch(
        new Request("http://localhost/api/meal-plans/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId: plan.id,
            rawJson: JSON.stringify({ slots: [{ type: "bogus", day: "mon" }] }),
          }),
        }),
      );

      expect(res.status).toBe(422);
      const data = await json(res);
      expect(data.error.code).toBe("GENERATION_FAILED");
    });

    test("returns 404 when planId does not exist", async () => {
      const res = await app.fetch(
        new Request("http://localhost/api/meal-plans/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId: "00000000-0000-0000-0000-000000000000",
            rawJson: JSON.stringify({ slots: [] }),
          }),
        }),
      );

      expect(res.status).toBe(404);
    });

    test("returns 503 for prompt path when no API key configured", async () => {
      const plan = await createPlan();

      // Ensure no API key is set
      const originalKey = process.env.ANTHROPIC_API_KEY;
      process.env.ANTHROPIC_API_KEY = undefined;

      try {
        const res = await app.fetch(
          new Request("http://localhost/api/meal-plans/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ planId: plan.id, prompt: "5 weeknight dinners" }),
          }),
        );

        expect(res.status).toBe(503);
        const data = await json(res);
        expect(data.error.code).toBe("GENERATION_UNAVAILABLE");
      } finally {
        if (originalKey !== undefined) {
          process.env.ANTHROPIC_API_KEY = originalKey;
        }
      }
    });
  });
}
