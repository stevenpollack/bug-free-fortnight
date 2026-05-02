import { and, eq, inArray } from "drizzle-orm";
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConsolidatedItem {
  item: string;
  quantity: number | null;
  unit: string | null;
}

export interface ShoppingListItemRead {
  id: string;
  display_order: number;
  item: string;
  quantity: number | null;
  unit: string | null;
  checked: boolean;
  custom: boolean;
  notes: string | null;
}

export interface ShoppingListRead {
  id: string;
  plan_id: string;
  generated_at: string;
  plan_snapshot_at: string;
  items: ShoppingListItemRead[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

export function toItemRead(row: typeof shoppingListItems.$inferSelect): ShoppingListItemRead {
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

export async function fetchShoppingList(listId: string): Promise<ShoppingListRead> {
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

export async function resolveShoppingList(planId: string) {
  const plan = await db.query.mealPlans.findFirst({ where: eq(mealPlans.id, planId) });
  if (!plan) throw new HttpError(404, "NOT_FOUND", "Meal plan not found");
  const list = await db.query.shoppingLists.findFirst({
    where: eq(shoppingLists.planId, planId),
  });
  if (!list) throw new HttpError(404, "NOT_FOUND", "Shopping list not found");
  return { plan, list };
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export async function generateShoppingList(planId: string): Promise<ShoppingListRead> {
  const [plan] = await db.select().from(mealPlans).where(eq(mealPlans.id, planId));
  if (!plan) throw new HttpError(404, "NOT_FOUND", "Meal plan not found");

  const slots = await db
    .select({ recipeId: mealPlanSlots.recipeId })
    .from(mealPlanSlots)
    .where(and(eq(mealPlanSlots.planId, planId)));

  const recipeIds = slots.map((s) => s.recipeId).filter((id): id is string => id != null);

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

  const consolidationMap = new Map<string, ConsolidatedItem>();
  for (const ing of ingredientRows) {
    const count = recipeSlotCounts.get(ing.recipeId) ?? 1;
    const key = `${ing.item.toLowerCase()}|${(ing.unit ?? "").toLowerCase()}`;
    const qty = parseNumeric(ing.quantity as unknown as string);

    const existing = consolidationMap.get(key);
    if (!existing) {
      consolidationMap.set(key, {
        item: ing.item,
        quantity: qty != null ? qty * count : null,
        unit: ing.unit ?? null,
      });
    } else {
      const newQty =
        existing.quantity != null && qty != null ? existing.quantity + qty * count : null;
      consolidationMap.set(key, { ...existing, quantity: newQty });
    }
  }

  const sorted = [...consolidationMap.values()].sort((a, b) =>
    a.item.toLowerCase().localeCompare(b.item.toLowerCase()),
  );

  const newListId = newId();
  await db.transaction(async (tx) => {
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

  return fetchShoppingList(newListId);
}

export async function addShoppingItem(
  planId: string,
  body: { item: string; quantity?: number | null; unit?: string | null; notes?: string | null },
): Promise<ShoppingListItemRead> {
  const { list } = await resolveShoppingList(planId);

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

  return toItemRead(inserted);
}

export async function patchShoppingItem(
  planId: string,
  itemId: string,
  patch: {
    checked?: boolean;
    item?: string;
    quantity?: number | null;
    unit?: string | null;
    notes?: string | null;
  },
): Promise<ShoppingListItemRead> {
  const { list } = await resolveShoppingList(planId);

  const [item] = await db
    .select()
    .from(shoppingListItems)
    .where(and(eq(shoppingListItems.id, itemId), eq(shoppingListItems.listId, list.id)));
  if (!item) throw new HttpError(404, "NOT_FOUND", "Shopping list item not found");

  const updateData: Partial<typeof shoppingListItems.$inferInsert> = {};
  if (patch.checked !== undefined) updateData.checked = patch.checked;
  if (patch.item !== undefined) updateData.item = patch.item;
  if ("quantity" in patch)
    updateData.quantity = patch.quantity != null ? String(patch.quantity) : null;
  if ("unit" in patch) updateData.unit = patch.unit ?? null;
  if ("notes" in patch) updateData.notes = patch.notes ?? null;

  const [updated] = await db
    .update(shoppingListItems)
    .set(updateData)
    .where(eq(shoppingListItems.id, itemId))
    .returning();

  return toItemRead(updated);
}

export async function deleteShoppingItem(planId: string, itemId: string): Promise<void> {
  const { list } = await resolveShoppingList(planId);

  const result = await db
    .delete(shoppingListItems)
    .where(and(eq(shoppingListItems.id, itemId), eq(shoppingListItems.listId, list.id)))
    .returning({ id: shoppingListItems.id });

  if (result.length === 0) throw new HttpError(404, "NOT_FOUND", "Shopping list item not found");
}
