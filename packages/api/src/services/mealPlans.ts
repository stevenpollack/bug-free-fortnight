import { desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { mealPlanSlots, mealPlans, recipes } from "../db/schema";
import { newId } from "../db/uuid";
import { HttpError } from "../errors";

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

export interface MealPlanDetail {
  id: string;
  name: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  slots: SlotsMap;
}

export interface MealPlanListItem {
  id: string;
  name: string | null;
  is_active: boolean;
  created_at: Date;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export async function fetchPlanDetail(planId: string): Promise<MealPlanDetail> {
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

export async function listMealPlans(): Promise<MealPlanListItem[]> {
  const rows = await db
    .select({
      id: mealPlans.id,
      name: mealPlans.name,
      isActive: mealPlans.isActive,
      createdAt: mealPlans.createdAt,
    })
    .from(mealPlans)
    .orderBy(desc(mealPlans.createdAt));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    is_active: r.isActive,
    created_at: r.createdAt,
  }));
}

export async function createMealPlan(name?: string | null): Promise<MealPlanDetail> {
  const id = newId();
  const now = new Date();
  await db
    .insert(mealPlans)
    .values({ id, name: name ?? null, isActive: false, createdAt: now, updatedAt: now });
  return fetchPlanDetail(id);
}

export async function updateMealPlan(id: string, name?: string | null): Promise<MealPlanDetail> {
  const [existing] = await db
    .select({ id: mealPlans.id })
    .from(mealPlans)
    .where(eq(mealPlans.id, id));
  if (!existing) throw new HttpError(404, "NOT_FOUND", "Meal plan not found");

  await db
    .update(mealPlans)
    .set({ name: name ?? null, updatedAt: new Date() })
    .where(eq(mealPlans.id, id));
  return fetchPlanDetail(id);
}

export async function deleteMealPlan(id: string): Promise<void> {
  const result = await db
    .delete(mealPlans)
    .where(eq(mealPlans.id, id))
    .returning({ id: mealPlans.id });
  if (result.length === 0) throw new HttpError(404, "NOT_FOUND", "Meal plan not found");
}

export async function activateMealPlan(id: string): Promise<MealPlanDetail> {
  const [existing] = await db
    .select({ id: mealPlans.id })
    .from(mealPlans)
    .where(eq(mealPlans.id, id));
  if (!existing) throw new HttpError(404, "NOT_FOUND", "Meal plan not found");

  await db.transaction(async (tx) => {
    await tx.update(mealPlans).set({ isActive: false, updatedAt: new Date() });
    await tx
      .update(mealPlans)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(mealPlans.id, id));
  });

  return fetchPlanDetail(id);
}

export async function setMealPlanSlot(
  planId: string,
  day: string,
  recipeId?: string | null,
  note?: string | null,
): Promise<MealPlanDetail> {
  const [plan] = await db
    .select({ id: mealPlans.id })
    .from(mealPlans)
    .where(eq(mealPlans.id, planId));
  if (!plan) throw new HttpError(404, "NOT_FOUND", "Meal plan not found");

  await db
    .insert(mealPlanSlots)
    .values({
      id: newId(),
      planId,
      dayOfWeek: day,
      recipeId: recipeId ?? null,
      note: note ?? null,
    })
    .onConflictDoUpdate({
      target: [mealPlanSlots.planId, mealPlanSlots.dayOfWeek],
      set: { recipeId: recipeId ?? null, note: note ?? null },
    });

  await db.update(mealPlans).set({ updatedAt: new Date() }).where(eq(mealPlans.id, planId));
  return fetchPlanDetail(planId);
}
