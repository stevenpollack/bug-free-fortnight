import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/client";
import { mealPlans, shoppingListItems, shoppingLists } from "../db/schema";
import { HttpError } from "../errors";
import { ShoppingListItemCreate, ShoppingListItemPatch } from "../schemas/index";
import {
  addShoppingItem,
  deleteShoppingItem,
  generateShoppingList,
  patchShoppingItem,
  toItemRead,
} from "../services/shoppingList";
import type { HonoEnv } from "../types";

export const shoppingListRouter = new Hono<HonoEnv>()
  .post("/meal-plans/:id/shopping-list/generate", async (c) => {
    const planId = c.req.param("id");
    const log = c.var.logger;
    const shoppingList = await generateShoppingList(planId);
    log.info({ planId, itemCount: shoppingList.items.length }, "shopping list generated");
    return c.json({ shoppingList }, 201);
  })
  .get("/meal-plans/:id/shopping-list", async (c) => {
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

    const shoppingList = {
      id: list.id,
      plan_id: list.planId,
      generated_at: list.generatedAt.toISOString(),
      plan_snapshot_at: list.planSnapshotAt.toISOString(),
      items: items.map(toItemRead),
    };

    return c.json({ shoppingList, plan_updated_at: plan.updatedAt.toISOString() });
  })
  .patch(
    "/meal-plans/:id/shopping-list/items/:itemId",
    zValidator("json", ShoppingListItemPatch),
    async (c) => {
      const planId = c.req.param("id");
      const itemId = c.req.param("itemId");
      const body = c.req.valid("json");
      const log = c.var.logger;
      const item = await patchShoppingItem(planId, itemId, body);
      log.info({ planId, itemId }, "shopping list item patched");
      return c.json({ item });
    },
  )
  .delete("/meal-plans/:id/shopping-list/items/:itemId", async (c) => {
    const planId = c.req.param("id");
    const itemId = c.req.param("itemId");
    const log = c.var.logger;
    await deleteShoppingItem(planId, itemId);
    log.info({ planId, itemId }, "shopping list item deleted");
    return new Response(null, { status: 204 });
  })
  .post(
    "/meal-plans/:id/shopping-list/items",
    zValidator("json", ShoppingListItemCreate),
    async (c) => {
      const planId = c.req.param("id");
      const body = c.req.valid("json");
      const log = c.var.logger;
      const item = await addShoppingItem(planId, body);
      log.info({ planId, itemId: item.id }, "custom shopping list item added");
      return c.json({ item }, 201);
    },
  );
