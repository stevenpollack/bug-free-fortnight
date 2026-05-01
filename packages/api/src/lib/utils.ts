import { newId } from "../db/uuid";
import type { IngredientWrite } from "../schemas/index";

export function parseNumeric(val: string | null | undefined): number | null {
  if (val == null) return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}

export type IngredientInsertRow = {
  id: string;
  recipeId: string;
  displayOrder: number;
  groupHeading: string | null;
  quantity: string | null;
  unit: string | null;
  item: string;
  notes: string | null;
  originalLine: string;
};

export function buildIngredientRows(
  recipeId: string,
  ingredients: IngredientWrite[],
): IngredientInsertRow[] {
  return ingredients.map((ing, idx) => ({
    id: newId(),
    recipeId,
    displayOrder: ing.displayOrder ?? idx,
    groupHeading: ing.groupHeading ?? null,
    quantity: ing.quantity != null ? String(ing.quantity) : null,
    unit: ing.unit ?? null,
    item: ing.item,
    notes: ing.notes ?? null,
    originalLine: ing.originalLine ?? ing.item,
  }));
}
