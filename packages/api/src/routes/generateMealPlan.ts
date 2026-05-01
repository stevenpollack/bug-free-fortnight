import Anthropic from "@anthropic-ai/sdk";
import { zValidator } from "@hono/zod-validator";
import { eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/client";
import { ingredients, mealPlanSlots, mealPlans, recipes } from "../db/schema";
import { newId } from "../db/uuid";
import { HttpError } from "../errors";
import { logger as rootLogger } from "../logger";
import { type GeneratedSlot, LlmMealPlanOutput, MealPlanGenerateBody } from "../schemas/index";
import type { HonoEnv } from "../types";

// ---------------------------------------------------------------------------
// System prompt for LLM
// ---------------------------------------------------------------------------

function buildSystemPrompt(
  mealPlanSchema: Record<string, unknown>,
  library: Array<{ id: string; title: string; tags: string[] }>,
  truncated: boolean,
): string {
  const schemaStr = JSON.stringify(mealPlanSchema, null, 2);
  const libraryStr = JSON.stringify(library, null, 2);

  return `You are a meal planner for a household. Your job is to fill a weekly meal plan with dinners.

IMPORTANT: Prefer reusing recipes from the user's existing library by referencing their id. Only invent new inline recipes when nothing in the library fits the request.

Return ONLY a valid JSON object — no markdown, no explanation, no code fences. The JSON must exactly match this JSON Schema:

\`\`\`json
${schemaStr}
\`\`\`

For each slot:
- If using an existing recipe: set type="existing" and provide the recipeId from the library below.
- If inventing a new recipe: set type="new" and provide a full recipe object matching the RecipeCreate schema embedded in the slot schema above. Set tagIds=[] and favourite=false.

Only fill the days the user asks for. Leave other days absent (do not include them in the slots array).
${truncated ? "\nNote: The library below is truncated to the most relevant entries. The user may have more recipes not shown here." : ""}

User's recipe library:
\`\`\`json
${libraryStr}
\`\`\`

Return raw JSON only.`;
}

// ---------------------------------------------------------------------------
// Atomic apply — shared by both prompt and rawJson paths
// ---------------------------------------------------------------------------

async function applyMealPlan(planId: string, slots: GeneratedSlot[]): Promise<void> {
  await db.transaction(async (tx) => {
    // 1. Verify the plan exists
    const [plan] = await tx
      .select({ id: mealPlans.id })
      .from(mealPlans)
      .where(eq(mealPlans.id, planId));
    if (!plan) throw new HttpError(404, "NOT_FOUND", "Meal plan not found");

    // 2. Verify all "existing" recipeIds actually exist in the DB
    const referencedIds = slots
      .filter((s) => s.type === "existing")
      .map((s) => (s as { type: "existing"; recipeId: string }).recipeId);

    if (referencedIds.length > 0) {
      const found = await tx
        .select({ id: recipes.id })
        .from(recipes)
        .where(inArray(recipes.id, referencedIds));

      if (found.length !== referencedIds.length) {
        throw new HttpError(
          422,
          "GENERATION_INVALID_REFERENCE",
          "LLM referenced one or more unknown recipe IDs",
        );
      }
    }

    // 3. Insert new recipes and upsert slots
    for (const slot of slots) {
      let recipeId: string;

      if (slot.type === "existing") {
        recipeId = slot.recipeId;
      } else {
        // Insert the new inline recipe
        recipeId = newId();
        const now = new Date();
        await tx.insert(recipes).values({
          id: recipeId,
          title: slot.recipe.title,
          description: slot.recipe.description ?? null,
          sourceUrl: slot.recipe.sourceUrl ?? null,
          imageUrl: slot.recipe.imageUrl ?? null,
          baseServings: slot.recipe.baseServings,
          prepTimeMinutes: slot.recipe.prepTimeMinutes ?? null,
          cookTimeMinutes: slot.recipe.cookTimeMinutes ?? null,
          notes: slot.recipe.notes ?? null,
          instructions: slot.recipe.instructions,
          favourite: slot.recipe.favourite,
          createdAt: now,
          updatedAt: now,
        });

        if (slot.recipe.ingredients.length > 0) {
          await tx.insert(ingredients).values(
            slot.recipe.ingredients.map((ing, idx) => ({
              id: newId(),
              recipeId,
              displayOrder: ing.displayOrder ?? idx,
              groupHeading: ing.groupHeading ?? null,
              quantity: ing.quantity != null ? String(ing.quantity) : null,
              unit: ing.unit ?? null,
              item: ing.item,
              notes: ing.notes ?? null,
              originalLine: ing.originalLine ?? ing.item,
            })),
          );
        }
      }

      // Upsert the slot (insert or update on day conflict)
      await tx
        .insert(mealPlanSlots)
        .values({
          id: newId(),
          planId,
          dayOfWeek: slot.day,
          recipeId,
          note: null,
        })
        .onConflictDoUpdate({
          target: [mealPlanSlots.planId, mealPlanSlots.dayOfWeek],
          set: { recipeId, note: null },
        });
    }

    // 4. Bump plan updatedAt
    await tx.update(mealPlans).set({ updatedAt: new Date() }).where(eq(mealPlans.id, planId));
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const generateMealPlanRouter = new Hono<HonoEnv>().post(
  "/meal-plans/generate",
  zValidator("json", MealPlanGenerateBody),
  async (c) => {
    const body = c.req.valid("json");
    const { planId } = body;
    const log = c.var.logger ?? rootLogger;

    // Determine which branch we're on
    const hasPrompt = "prompt" in body;

    let parsed: unknown;

    if (hasPrompt) {
      // ----- Prompt branch: call Anthropic -----
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return c.json(
          {
            error: {
              code: "GENERATION_UNAVAILABLE",
              message: "Meal plan generation is not configured",
            },
          },
          503,
        );
      }

      // Build compact library from DB
      const allRecipes = await db.select({ id: recipes.id, title: recipes.title }).from(recipes);

      // Cap at 150; no tag join needed for compact format
      const LIBRARY_CAP = 150;
      const truncated = allRecipes.length > LIBRARY_CAP;
      const library = allRecipes.slice(0, LIBRARY_CAP).map((r) => ({
        id: r.id,
        title: r.title,
        tags: [] as string[],
      }));

      const mealPlanSchema = z.toJSONSchema(LlmMealPlanOutput);
      const systemPrompt = buildSystemPrompt(mealPlanSchema, library, truncated);

      const anthropic = new Anthropic({ apiKey });

      let rawText: string;
      try {
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 8192,
          system: systemPrompt,
          messages: [{ role: "user", content: body.prompt }],
        });

        const block = response.content[0];
        if (block?.type !== "text") {
          return c.json(
            {
              error: {
                code: "GENERATION_FAILED",
                message: "Claude returned an unexpected response type",
              },
            },
            422,
          );
        }
        rawText = block.text;
      } catch (err) {
        if (err instanceof Anthropic.RateLimitError) {
          return c.json(
            {
              error: {
                code: "RATE_LIMITED",
                message: "Too many requests — please try again shortly",
              },
            },
            429,
          );
        }
        throw err;
      }

      try {
        parsed = JSON.parse(rawText);
      } catch {
        return c.json(
          {
            error: {
              code: "GENERATION_FAILED",
              message: "Claude returned non-JSON output",
            },
          },
          422,
        );
      }
    } else {
      // ----- rawJson branch: skip Anthropic -----
      try {
        parsed = JSON.parse(body.rawJson);
      } catch {
        return c.json(
          {
            error: {
              code: "INVALID_JSON",
              message: "Invalid JSON — check for missing commas or brackets",
            },
          },
          422,
        );
      }
    }

    // Validate against LlmMealPlanOutput schema
    const result = LlmMealPlanOutput.safeParse(parsed);
    if (!result.success) {
      const msg = result.error.issues[0]?.message ?? "unknown error";
      return c.json(
        {
          error: {
            code: "GENERATION_FAILED",
            message: `Output did not match expected schema: ${msg}`,
          },
        },
        422,
      );
    }

    // Apply atomically
    try {
      await applyMealPlan(planId, result.data.slots);
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw err;
    }

    log.info({ planId, slotCount: result.data.slots.length }, "meal plan generated");
    return c.json({ ok: true, slotCount: result.data.slots.length });
  },
);
