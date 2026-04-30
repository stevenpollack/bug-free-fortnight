import { describe, expect, test } from "bun:test";
import { IngredientInput, RecipeBase, TagInput } from "./index";

const validRecipe = {
  title: "Fluffy Pancakes",
  baseServings: 4,
  instructions: ["Mix dry ingredients.", "Add wet ingredients.", "Cook on griddle."],
};

// ---------------------------------------------------------------------------
// RecipeBase
// ---------------------------------------------------------------------------

describe("RecipeBase", () => {
  test("accepts a minimal happy-path recipe", () => {
    const result = RecipeBase.safeParse(validRecipe);
    expect(result.success).toBe(true);
  });

  test("accepts a fully-populated recipe", () => {
    const result = RecipeBase.safeParse({
      title: "Beef Stroganoff",
      description: "Rich and creamy.",
      sourceUrl: "https://www.recipetineats.com/beef-stroganoff/",
      imageUrl: "https://www.recipetineats.com/wp-content/uploads/2020/beef.jpg",
      baseServings: 6,
      prepTimeMinutes: 15,
      cookTimeMinutes: 30,
      notes: "Serve over egg noodles.",
      instructions: ["Sear beef.", "Make sauce.", "Combine."],
      favourite: true,
    });
    expect(result.success).toBe(true);
  });

  test("rejects missing title", () => {
    const result = RecipeBase.safeParse({ ...validRecipe, title: undefined });
    expect(result.success).toBe(false);
  });

  test("rejects empty title", () => {
    const result = RecipeBase.safeParse({ ...validRecipe, title: "" });
    expect(result.success).toBe(false);
  });

  test("rejects baseServings of 0", () => {
    const result = RecipeBase.safeParse({ ...validRecipe, baseServings: 0 });
    expect(result.success).toBe(false);
  });

  test("rejects negative baseServings", () => {
    const result = RecipeBase.safeParse({ ...validRecipe, baseServings: -1 });
    expect(result.success).toBe(false);
  });

  test("rejects non-integer baseServings", () => {
    const result = RecipeBase.safeParse({ ...validRecipe, baseServings: 1.5 });
    expect(result.success).toBe(false);
  });

  test("rejects malformed sourceUrl", () => {
    const result = RecipeBase.safeParse({ ...validRecipe, sourceUrl: "not-a-url" });
    expect(result.success).toBe(false);
  });

  test("defaults favourite to false", () => {
    const result = RecipeBase.safeParse(validRecipe);
    expect(result.success && result.data.favourite).toBe(false);
  });

  test("defaults instructions to empty array", () => {
    const result = RecipeBase.safeParse({ title: "Simple", baseServings: 2 });
    expect(result.success && result.data.instructions).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// IngredientInput
// ---------------------------------------------------------------------------

describe("IngredientInput", () => {
  const validIngredient = {
    displayOrder: 0,
    item: "plain flour",
    originalLine: "2 cups plain flour",
  };

  test("accepts a minimal happy-path ingredient", () => {
    const result = IngredientInput.safeParse(validIngredient);
    expect(result.success).toBe(true);
  });

  test("accepts a fully-populated ingredient", () => {
    const result = IngredientInput.safeParse({
      displayOrder: 1,
      groupHeading: "Dry ingredients",
      quantity: 2,
      unit: "cups",
      item: "plain flour",
      notes: "sifted",
      originalLine: "2 cups plain flour, sifted",
    });
    expect(result.success).toBe(true);
  });

  test("rejects missing item", () => {
    const result = IngredientInput.safeParse({ ...validIngredient, item: undefined });
    expect(result.success).toBe(false);
  });

  test("rejects missing originalLine", () => {
    const result = IngredientInput.safeParse({ ...validIngredient, originalLine: undefined });
    expect(result.success).toBe(false);
  });

  test("rejects negative quantity", () => {
    const result = IngredientInput.safeParse({ ...validIngredient, quantity: -1 });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TagInput
// ---------------------------------------------------------------------------

describe("TagInput", () => {
  test("accepts a tag with name and category", () => {
    const result = TagInput.safeParse({ name: "italian", category: "cuisine" });
    expect(result.success).toBe(true);
  });

  test("accepts a tag without category", () => {
    const result = TagInput.safeParse({ name: "quick" });
    expect(result.success).toBe(true);
  });

  test("rejects empty name", () => {
    const result = TagInput.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});
