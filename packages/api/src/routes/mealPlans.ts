import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { DayOfWeek, MealPlanCreate, MealPlanUpdate } from "../schemas/index";
import {
  activateMealPlan,
  createMealPlan,
  deleteMealPlan,
  fetchPlanDetail,
  listMealPlans,
  setMealPlanSlot,
  updateMealPlan,
} from "../services/mealPlans";
import type { HonoEnv } from "../types";

const SlotBody = z.object({
  recipe_id: z.string().uuid().nullable().optional(),
  note: z.string().max(200).nullable().optional(),
});

export const mealPlanRouter = new Hono<HonoEnv>()
  .get("/meal-plans", async (c) => {
    const mealPlans = await listMealPlans();
    return c.json({ mealPlans });
  })
  .post("/meal-plans", zValidator("json", MealPlanCreate), async (c) => {
    const body = c.req.valid("json");
    const mealPlan = await createMealPlan(body.name);
    const log = c.var.logger;
    log.info({ planId: mealPlan.id }, "meal plan created");
    return c.json({ mealPlan }, 201);
  })
  .get("/meal-plans/:id", async (c) => {
    const mealPlan = await fetchPlanDetail(c.req.param("id"));
    return c.json({ mealPlan });
  })
  .patch("/meal-plans/:id", zValidator("json", MealPlanUpdate), async (c) => {
    const id = c.req.param("id");
    const body = c.req.valid("json");
    const mealPlan = await updateMealPlan(id, body.name);
    const log = c.var.logger;
    log.info({ planId: id }, "meal plan updated");
    return c.json({ mealPlan });
  })
  .delete("/meal-plans/:id", async (c) => {
    const id = c.req.param("id");
    await deleteMealPlan(id);
    const log = c.var.logger;
    log.info({ planId: id }, "meal plan deleted");
    return new Response(null, { status: 204 });
  })
  .post("/meal-plans/:id/activate", async (c) => {
    const id = c.req.param("id");
    const mealPlan = await activateMealPlan(id);
    const log = c.var.logger;
    log.info({ planId: id }, "meal plan activated");
    return c.json({ mealPlan });
  })
  .put(
    "/meal-plans/:id/slots/:day",
    zValidator("param", z.object({ id: z.string(), day: DayOfWeek })),
    zValidator("json", SlotBody),
    async (c) => {
      const { id: planId, day } = c.req.valid("param");
      const body = c.req.valid("json");
      const mealPlan = await setMealPlanSlot(planId, day, body.recipe_id, body.note);
      const log = c.var.logger;
      log.info({ planId, day }, "meal plan slot upserted");
      return c.json({ mealPlan });
    },
  );
