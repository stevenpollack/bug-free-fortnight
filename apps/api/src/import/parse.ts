import { parseIngredient } from "parse-ingredient";

export interface ParsedIngredient {
  quantity: number | null;
  unit: string | null;
  item: string;
  notes: string | null;
}

/**
 * Parse a raw ingredient line into structured fields.
 * Falls back to `{ quantity: null, unit: null, item: line, notes: null }` when
 * the parser cannot extract anything meaningful.
 */
export function parseIngredientLine(line: string): ParsedIngredient {
  const trimmed = line.trim();
  if (!trimmed) return { quantity: null, unit: null, item: line, notes: null };

  try {
    const results = parseIngredient(trimmed);
    const r = results[0];

    if (!r || !r.description) {
      return { quantity: null, unit: null, item: trimmed || line, notes: null };
    }

    return {
      quantity: r.quantity ?? null,
      unit: r.unitOfMeasure ?? null,
      item: r.description,
      notes: null,
    };
  } catch {
    return { quantity: null, unit: null, item: trimmed || line, notes: null };
  }
}
