import { describe, expect, test } from "bun:test";
import { parseIngredientLine } from "../parse";

describe("parseIngredientLine", () => {
  test('"1 cup whole milk" parses correctly', () => {
    const result = parseIngredientLine("1 cup whole milk");
    expect(result.quantity).toBe(1);
    expect(result.unit).toBe("cup");
    expect(result.item).toBe("whole milk");
  });

  test('"1/2 tsp salt" yields quantity 0.5', () => {
    const result = parseIngredientLine("1/2 tsp salt");
    expect(result.quantity).toBe(0.5);
    expect(result.unit).not.toBeNull();
    expect(result.item).toContain("salt");
  });

  test('"to taste" falls back to plain item', () => {
    const result = parseIngredientLine("to taste");
    // When nothing useful is parsed, item should equal the raw line
    expect(result.item).toBe("to taste");
    // quantity and unit may be null or the parser may extract something; we only require item
  });

  test('"4 thick slices bread" has quantity 4', () => {
    const result = parseIngredientLine("4 thick slices bread");
    expect(result.quantity).toBe(4);
  });

  test("empty string returns plain item", () => {
    const result = parseIngredientLine("");
    expect(result.quantity).toBeNull();
    expect(result.unit).toBeNull();
  });

  test("always returns non-null item string", () => {
    const lines = ["salt and pepper to taste", "a handful of parsley", "2 tablespoons olive oil"];
    for (const line of lines) {
      const result = parseIngredientLine(line);
      expect(typeof result.item).toBe("string");
      expect(result.item.length).toBeGreaterThan(0);
    }
  });
});
