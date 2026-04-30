import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const recipes = pgTable("recipes", {
  id: uuid("id").notNull().primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  sourceUrl: text("source_url"),
  imageUrl: text("image_url"),
  baseServings: integer("base_servings").notNull().default(1),
  prepTimeMinutes: integer("prep_time_minutes"),
  cookTimeMinutes: integer("cook_time_minutes"),
  notes: text("notes"),
  instructions: jsonb("instructions").notNull().$type<string[]>().default([]),
  favourite: boolean("favourite").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ingredients = pgTable(
  "ingredients",
  {
    id: uuid("id").notNull().primaryKey(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    displayOrder: integer("display_order").notNull(),
    groupHeading: text("group_heading"),
    quantity: numeric("quantity", { precision: 10, scale: 4 }),
    unit: text("unit"),
    item: text("item").notNull(),
    notes: text("notes"),
    originalLine: text("original_line").notNull(),
  },
  (t) => [index("ingredients_recipe_order_idx").on(t.recipeId, t.displayOrder)],
);

export const tags = pgTable("tags", {
  id: uuid("id").notNull().primaryKey(),
  name: text("name").notNull().unique(),
  category: text("category"),
});

export const recipeTags = pgTable(
  "recipe_tags",
  {
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.recipeId, t.tagId] })],
);

export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
export type Ingredient = typeof ingredients.$inferSelect;
export type NewIngredient = typeof ingredients.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type RecipeTag = typeof recipeTags.$inferSelect;

// ---------------------------------------------------------------------------
// Meal planner
// ---------------------------------------------------------------------------

export const mealPlans = pgTable("meal_plans", {
  id: uuid("id").notNull().primaryKey(),
  name: text("name"),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mealPlanSlots = pgTable(
  "meal_plan_slots",
  {
    id: uuid("id").notNull().primaryKey(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => mealPlans.id, { onDelete: "cascade" }),
    dayOfWeek: text("day_of_week").notNull(),
    recipeId: uuid("recipe_id").references(() => recipes.id, { onDelete: "set null" }),
    note: text("note"),
  },
  (t) => [unique("meal_plan_slots_plan_day_unique").on(t.planId, t.dayOfWeek)],
);

export type MealPlan = typeof mealPlans.$inferSelect;
export type NewMealPlan = typeof mealPlans.$inferInsert;
export type MealPlanSlot = typeof mealPlanSlots.$inferSelect;
export type NewMealPlanSlot = typeof mealPlanSlots.$inferInsert;
