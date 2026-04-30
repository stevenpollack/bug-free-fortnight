import { zValidator } from "@hono/zod-validator";
import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/client";
import { mealPlanSlots, mealPlans, recipes } from "../db/schema";
import { newId } from "../db/uuid";
import { HttpError } from "../errors";
import { logger as rootLogger } from "../logger";
import { DayOfWeek, MealPlanCreate, MealPlanUpdate } from "../schemas/index";
import type { HonoEnv } from "../types";

export const mealPlanRouter = new Hono<HonoEnv>();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

const ALL_DAYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

interface SlotDetail {
  recipe_id: string | null;
  recipe_title: string | null;
  recipe_image_url: string | null;
  note: string | null;
}

type SlotsMap = Record<DayKey, SlotDetail | null>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchPlanDetail(planId: string) {
  const [plan] = await db.select().from(mealPlans).where(eq(mealPlans.id, planId));
  if (!plan) throw new HttpError(404, "NOT_FOUND", "Meal plan not found");

  const slotRows = await db
    .select({
      dayOfWeek: mealPlanSlots.dayOfWeek,
      recipeId: mealPlanSlots.recipeId,
      note: mealPlanSlots.note,
      recipeTitle: recipes.title,
      recipeImageUrl: recipes.imageUrl,
    })
    .from(mealPlanSlots)
    .leftJoin(recipes, eq(mealPlanSlots.recipeId, recipes.id))
    .where(eq(mealPlanSlots.planId, planId));

  const slots: SlotsMap = Object.fromEntries(ALL_DAYS.map((d) => [d, null])) as SlotsMap;

  for (const row of slotRows) {
    const day = row.dayOfWeek as DayKey;
    if (ALL_DAYS.includes(day)) {
      slots[day] = {
        recipe_id: row.recipeId ?? null,
        recipe_title: row.recipeTitle ?? null,
        recipe_image_url: row.recipeImageUrl ?? null,
        note: row.note ?? null,
      };
    }
  }

  return {
    id: plan.id,
    name: plan.name,
    is_active: plan.isActive,
    created_at: plan.createdAt,
    updated_at: plan.updatedAt,
    slots,
  };
}

// ---------------------------------------------------------------------------
// GET /meal-plans
// ---------------------------------------------------------------------------

mealPlanRouter.get("/meal-plans", async (c) => {
  const rows = await db
    .select({
      id: mealPlans.id,
      name: mealPlans.name,
      isActive: mealPlans.isActive,
      createdAt: mealPlans.createdAt,
    })
    .from(mealPlans)
    .orderBy(desc(mealPlans.createdAt));

  return c.json({
    mealPlans: rows.map((r) => ({
      id: r.id,
      name: r.name,
      is_active: r.isActive,
      created_at: r.createdAt,
    })),
  });
});

// ---------------------------------------------------------------------------
// POST /meal-plans
// ---------------------------------------------------------------------------

mealPlanRouter.post("/meal-plans", zValidator("json", MealPlanCreate), async (c) => {
  const body = c.req.valid("json");
  const id = newId();
  const now = new Date();

  await db.insert(mealPlans).values({
    id,
    name: body.name ?? null,
    isActive: false,
    createdAt: now,
    updatedAt: now,
  });

  const plan = await fetchPlanDetail(id);
  const log = c.var.logger ?? rootLogger;
  log.info({ planId: id }, "meal plan created");
  return c.json({ mealPlan: plan }, 201);
});

// ---------------------------------------------------------------------------
// GET /meal-plans/:id
// ---------------------------------------------------------------------------

mealPlanRouter.get("/meal-plans/:id", async (c) => {
  const plan = await fetchPlanDetail(c.req.param("id"));
  return c.json({ mealPlan: plan });
});

// ---------------------------------------------------------------------------
// PATCH /meal-plans/:id
// ---------------------------------------------------------------------------

mealPlanRouter.patch("/meal-plans/:id", zValidator("json", MealPlanUpdate), async (c) => {
  const id = c.req.param("id");
  const body = c.req.valid("json");

  const [existing] = await db
    .select({ id: mealPlans.id })
    .from(mealPlans)
    .where(eq(mealPlans.id, id));
  if (!existing) throw new HttpError(404, "NOT_FOUND", "Meal plan not found");

  await db
    .update(mealPlans)
    .set({ name: body.name ?? null, updatedAt: new Date() })
    .where(eq(mealPlans.id, id));

  const plan = await fetchPlanDetail(id);
  const log = c.var.logger ?? rootLogger;
  log.info({ planId: id }, "meal plan updated");
  return c.json({ mealPlan: plan });
});

// ---------------------------------------------------------------------------
// DELETE /meal-plans/:id
// ---------------------------------------------------------------------------

mealPlanRouter.delete("/meal-plans/:id", async (c) => {
  const id = c.req.param("id");
  const result = await db
    .delete(mealPlans)
    .where(eq(mealPlans.id, id))
    .returning({ id: mealPlans.id });

  if (result.length === 0) throw new HttpError(404, "NOT_FOUND", "Meal plan not found");

  const log = c.var.logger ?? rootLogger;
  log.info({ planId: id }, "meal plan deleted");
  return new Response(null, { status: 204 });
});

// ---------------------------------------------------------------------------
// POST /meal-plans/:id/activate
// ---------------------------------------------------------------------------

mealPlanRouter.post("/meal-plans/:id/activate", async (c) => {
  const id = c.req.param("id");

  const [existing] = await db
    .select({ id: mealPlans.id })
    .from(mealPlans)
    .where(eq(mealPlans.id, id));
  if (!existing) throw new HttpError(404, "NOT_FOUND", "Meal plan not found");

  await db.transaction(async (tx) => {
    // Clear all active flags first
    await tx.update(mealPlans).set({ isActive: false, updatedAt: new Date() });
    // Set this plan as active
    await tx
      .update(mealPlans)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(mealPlans.id, id));
  });

  const plan = await fetchPlanDetail(id);
  const log = c.var.logger ?? rootLogger;
  log.info({ planId: id }, "meal plan activated");
  return c.json({ mealPlan: plan });
});

// ---------------------------------------------------------------------------
// PUT /meal-plans/:id/slots/:day
// ---------------------------------------------------------------------------

const SlotBody = z.object({
  recipe_id: z.string().uuid().nullable().optional(),
  note: z.string().max(200).nullable().optional(),
});

mealPlanRouter.put(
  "/meal-plans/:id/slots/:day",
  zValidator("param", z.object({ id: z.string(), day: DayOfWeek })),
  zValidator("json", SlotBody),
  async (c) => {
    const { id: planId, day } = c.req.valid("param");
    const body = c.req.valid("json");

    const [plan] = await db
      .select({ id: mealPlans.id })
      .from(mealPlans)
      .where(eq(mealPlans.id, planId));
    if (!plan) throw new HttpError(404, "NOT_FOUND", "Meal plan not found");

    const recipeId = body.recipe_id ?? null;
    const note = body.note ?? null;

    // Upsert: insert or update on conflict; both null = clear slot content
    await db
      .insert(mealPlanSlots)
      .values({
        id: newId(),
        planId,
        dayOfWeek: day,
        recipeId,
        note,
      })
      .onConflictDoUpdate({
        target: [mealPlanSlots.planId, mealPlanSlots.dayOfWeek],
        set: {
          recipeId,
          note,
        },
      });

    const planDetail = await fetchPlanDetail(planId);
    const log = c.var.logger ?? rootLogger;
    log.info({ planId, day }, "meal plan slot upserted");
    return c.json({ mealPlan: planDetail });
  },
);
