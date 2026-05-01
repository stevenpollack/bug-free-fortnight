import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/client";
import {
  ingredients,
  mealPlanSlots,
  mealPlans,
  shoppingListItems,
  shoppingLists,
} from "../db/schema";
import { newId } from "../db/uuid";
import { HttpError } from "../errors";
import { parseNumeric } from "../lib/utils";
import { logger as rootLogger } from "../logger";
import { ShoppingListItemCreate, ShoppingListItemPatch } from "../schemas/index";
import type { HonoEnv } from "../types";

export const shoppingListRouter = new Hono<HonoEnv>();

interface ConsolidatedItem {
  item: string;
  quantity: number | null;
  unit: string | null;
}

interface ShoppingListItemRead {
  id: string;
  display_order: number;
  item: string;
  quantity: number | null;
  unit: string | null;
  checked: boolean;
  custom: boolean;
  notes: string | null;
}

interface ShoppingListRead {
  id: string;
  plan_id: string;
  generated_at: string;
  plan_snapshot_at: string;
  items: ShoppingListItemRead[];
}

function toItemRead(row: typeof shoppingListItems.$inferSelect): ShoppingListItemRead {
  return {
    id: row.id,
    display_order: row.displayOrder,
    item: row.item,
    quantity: parseNumeric(row.quantity as unknown as string),
    unit: row.unit ?? null,
    checked: row.checked,
    custom: row.custom,
    notes: row.notes ?? null,
  };
}

async function fetchShoppingList(listId: string): Promise<ShoppingListRead> {
  const [list] = await db.select().from(shoppingLists).where(eq(shoppingLists.id, listId));
  if (!list) throw new HttpError(404, "NOT_FOUND", "Shopping list not found");

  const items = await db
    .select()
    .from(shoppingListItems)
    .where(eq(shoppingListItems.listId, listId))
    .orderBy(shoppingListItems.displayOrder);

  return {
    id: list.id,
    plan_id: list.planId,
    generated_at: list.generatedAt.toISOString(),
    plan_snapshot_at: list.planSnapshotAt.toISOString(),
    items: items.map(toItemRead),
  };
}

async function resolveShoppingList(planId: string) {
  const plan = await db.query.mealPlans.findFirst({ where: eq(mealPlans.id, planId) });
  if (!plan) throw new HttpError(404, "NOT_FOUND", "Meal plan not found");
  const list = await db.query.shoppingLists.findFirst({
    where: eq(shoppingLists.planId, planId),
  });
  if (!list) throw new HttpError(404, "NOT_FOUND", "Shopping list not found");
  return { plan, list };
}

// ---------------------------------------------------------------------------
// POST /meal-plans/:id/shopping-list/generate
// ---------------------------------------------------------------------------

shoppingListRouter.post("/meal-plans/:id/shopping-list/generate", async (c) => {
  const planId = c.req.param("id");
  const log = c.var.logger ?? rootLogger;

  const [plan] = await db.select().from(mealPlans).where(eq(mealPlans.id, planId));
  if (!plan) throw new HttpError(404, "NOT_FOUND", "Meal plan not found");

  // Fetch all slots that have a recipe
  const slots = await db
    .select({ recipeId: mealPlanSlots.recipeId })
    .from(mealPlanSlots)
    .where(and(eq(mealPlanSlots.planId, planId)));

  const recipeIds = slots.map((s) => s.recipeId).filter((id): id is string => id != null);

  // Fetch ingredients for all recipes (one query, may have duplicates for same recipe on multiple days)
  // We need to count each recipe occurrence so we replicate ingredients per slot
  const recipeSlotCounts = new Map<string, number>();
  for (const id of recipeIds) {
    recipeSlotCounts.set(id, (recipeSlotCounts.get(id) ?? 0) + 1);
  }

  const uniqueRecipeIds = [...recipeSlotCounts.keys()];

  let ingredientRows: (typeof ingredients.$inferSelect)[] = [];
  if (uniqueRecipeIds.length > 0) {
    ingredientRows = await db
      .select()
      .from(ingredients)
      .where(inArray(ingredients.recipeId, uniqueRecipeIds));
  }

  // Consolidate: key = item.toLowerCase() + "|" + (unit?.toLowerCase() ?? "")
  const consolidationMap = new Map<string, ConsolidatedItem>();

  for (const ing of ingredientRows) {
    const count = recipeSlotCounts.get(ing.recipeId) ?? 1;
    const key = `${ing.item.toLowerCase()}|${(ing.unit ?? "").toLowerCase()}`;
    const qty = parseNumeric(ing.quantity as unknown as string);

    const existing = consolidationMap.get(key);
    if (!existing) {
      // First occurrence — multiply quantity by slot count
      consolidationMap.set(key, {
        item: ing.item,
        quantity: qty != null ? qty * count : null,
        unit: ing.unit ?? null,
      });
    } else {
      // Merge: if either side is null, result is null; otherwise sum
      const newQty =
        existing.quantity != null && qty != null ? existing.quantity + qty * count : null;
      consolidationMap.set(key, { ...existing, quantity: newQty });
    }
  }

  // Sort alphabetically for display_order
  const sorted = [...consolidationMap.values()].sort((a, b) =>
    a.item.toLowerCase().localeCompare(b.item.toLowerCase()),
  );

  // Wrap in transaction: delete old list + insert new list + items
  const newListId = newId();
  await db.transaction(async (tx) => {
    // Delete existing shopping list for this plan (cascade deletes items)
    await tx.delete(shoppingLists).where(eq(shoppingLists.planId, planId));

    await tx.insert(shoppingLists).values({
      id: newListId,
      planId,
      generatedAt: new Date(),
      planSnapshotAt: plan.updatedAt,
    });

    if (sorted.length > 0) {
      await tx.insert(shoppingListItems).values(
        sorted.map((item, idx) => ({
          id: newId(),
          listId: newListId,
          displayOrder: idx,
          item: item.item,
          quantity: item.quantity != null ? String(item.quantity) : null,
          unit: item.unit,
          checked: false,
          custom: false,
          notes: null,
        })),
      );
    }
  });

  const result = await fetchShoppingList(newListId);
  log.info({ planId, itemCount: sorted.length }, "shopping list generated");
  return c.json({ shoppingList: result }, 201);
});

// ---------------------------------------------------------------------------
// GET /meal-plans/:id/shopping-list
// ---------------------------------------------------------------------------

shoppingListRouter.get("/meal-plans/:id/shopping-list", async (c) => {
  const planId = c.req.param("id");

  const [plan] = await db.select().from(mealPlans).where(eq(mealPlans.id, planId));
  if (!plan) throw new HttpError(404, "NOT_FOUND", "Meal plan not found");

  const [list] = await db.select().from(shoppingLists).where(eq(shoppingLists.planId, planId));

  if (!list) {
    return c.json({ shoppingList: null, plan_updated_at: plan.updatedAt.toISOString() });
  }

  const items = await db
    .select()
    .from(shoppingListItems)
    .where(eq(shoppingListItems.listId, list.id))
    .orderBy(shoppingListItems.displayOrder);

  const result: ShoppingListRead = {
    id: list.id,
    plan_id: list.planId,
    generated_at: list.generatedAt.toISOString(),
    plan_snapshot_at: list.planSnapshotAt.toISOString(),
    items: items.map(toItemRead),
  };

  return c.json({ shoppingList: result, plan_updated_at: plan.updatedAt.toISOString() });
});

// ---------------------------------------------------------------------------
// PATCH /meal-plans/:id/shopping-list/items/:itemId
// ---------------------------------------------------------------------------

shoppingListRouter.patch(
  "/meal-plans/:id/shopping-list/items/:itemId",
  zValidator("json", ShoppingListItemPatch),
  async (c) => {
    const planId = c.req.param("id");
    const itemId = c.req.param("itemId");
    const body = c.req.valid("json");
    const log = c.var.logger ?? rootLogger;

    const { list } = await resolveShoppingList(planId);

    const [item] = await db
      .select()
      .from(shoppingListItems)
      .where(and(eq(shoppingListItems.id, itemId), eq(shoppingListItems.listId, list.id)));
    if (!item) throw new HttpError(404, "NOT_FOUND", "Shopping list item not found");

    const updateData: Partial<typeof shoppingListItems.$inferInsert> = {};
    if (body.checked !== undefined) updateData.checked = body.checked;
    if (body.item !== undefined) updateData.item = body.item;
    if ("quantity" in body)
      updateData.quantity = body.quantity != null ? String(body.quantity) : null;
    if ("unit" in body) updateData.unit = body.unit ?? null;
    if ("notes" in body) updateData.notes = body.notes ?? null;

    const [updated] = await db
      .update(shoppingListItems)
      .set(updateData)
      .where(eq(shoppingListItems.id, itemId))
      .returning();

    log.info({ planId, itemId }, "shopping list item patched");
    return c.json({ item: toItemRead(updated) });
  },
);

// ---------------------------------------------------------------------------
// DELETE /meal-plans/:id/shopping-list/items/:itemId
// ---------------------------------------------------------------------------

shoppingListRouter.delete("/meal-plans/:id/shopping-list/items/:itemId", async (c) => {
  const planId = c.req.param("id");
  const itemId = c.req.param("itemId");
  const log = c.var.logger ?? rootLogger;

  const { list } = await resolveShoppingList(planId);

  const result = await db
    .delete(shoppingListItems)
    .where(and(eq(shoppingListItems.id, itemId), eq(shoppingListItems.listId, list.id)))
    .returning({ id: shoppingListItems.id });

  if (result.length === 0) throw new HttpError(404, "NOT_FOUND", "Shopping list item not found");

  log.info({ planId, itemId }, "shopping list item deleted");
  return new Response(null, { status: 204 });
});

// ---------------------------------------------------------------------------
// POST /meal-plans/:id/shopping-list/items  (add custom item)
// ---------------------------------------------------------------------------

shoppingListRouter.post(
  "/meal-plans/:id/shopping-list/items",
  zValidator("json", ShoppingListItemCreate),
  async (c) => {
    const planId = c.req.param("id");
    const body = c.req.valid("json");
    const log = c.var.logger ?? rootLogger;

    const { list } = await resolveShoppingList(planId);

    // Find max display_order
    const existingItems = await db
      .select({ displayOrder: shoppingListItems.displayOrder })
      .from(shoppingListItems)
      .where(eq(shoppingListItems.listId, list.id))
      .orderBy(shoppingListItems.displayOrder);

    const maxOrder =
      existingItems.length > 0 ? existingItems[existingItems.length - 1].displayOrder : -1;

    const newItemId = newId();
    await db.insert(shoppingListItems).values({
      id: newItemId,
      listId: list.id,
      displayOrder: maxOrder + 1,
      item: body.item,
      quantity: body.quantity != null ? String(body.quantity) : null,
      unit: body.unit ?? null,
      checked: false,
      custom: true,
      notes: body.notes ?? null,
    });

    const [inserted] = await db
      .select()
      .from(shoppingListItems)
      .where(eq(shoppingListItems.id, newItemId));

    log.info({ planId, itemId: newItemId }, "custom shopping list item added");
    return c.json({ item: toItemRead(inserted) }, 201);
  },
);
