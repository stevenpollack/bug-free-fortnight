import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { importRecipeTinEats } from "../recipetineats";
import type { Fetcher } from "../safeFetch";

const fixtureDir = join(import.meta.dir, "fixtures");

function htmlFetcher(filename: string): Fetcher {
  const html = readFileSync(join(fixtureDir, filename), "utf8");
  return () =>
    Promise.resolve(
      new Response(html, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }),
    );
}

const RTE_URL = "https://www.recipetineats.com/french-toast/#recipe";

describe("importRecipeTinEats", () => {
  test("parses French Toast fixture into a RecipeCreate payload", async () => {
    const { recipe, warnings } = await importRecipeTinEats(
      RTE_URL,
      htmlFetcher("french-toast.html"),
    );

    expect(recipe.title).toBe("French Toast");
    expect(recipe.baseServings).toBe(4);
    expect(recipe.prepTimeMinutes).toBe(5);
    expect(recipe.cookTimeMinutes).toBe(15);
    expect(recipe.ingredients.length).toBe(5);
    expect(recipe.instructions.length).toBe(3);
    expect(recipe.tagIds).toEqual([]);
    expect(recipe.favourite).toBe(false);
    expect(recipe.sourceUrl).toBe(RTE_URL);
    expect(recipe.imageUrl).toBe("https://www.recipetineats.com/images/french-toast.jpg");

    // description should strip HTML tags
    expect(recipe.description).toBe("The best French Toast recipe.");

    // Each ingredient should have displayOrder matching its index
    for (let i = 0; i < recipe.ingredients.length; i++) {
      expect(recipe.ingredients[i].displayOrder).toBe(i);
      expect(typeof recipe.ingredients[i].originalLine).toBe("string");
    }

    // No warnings expected for a well-formed fixture
    expect(warnings.length).toBe(0);
  });

  test("parses @graph fixture", async () => {
    const { recipe } = await importRecipeTinEats(RTE_URL, htmlFetcher("graph.html"));
    expect(recipe.title).toBe("Graph French Toast");
    expect(recipe.baseServings).toBe(2);
    expect(recipe.ingredients.length).toBe(2);
  });

  test("rejects disallowed URL", async () => {
    await expect(importRecipeTinEats("https://www.evil.com/recipe/")).rejects.toThrow();
  });

  test("throws when no Recipe JSON-LD is found", async () => {
    const noRecipeFetcher: Fetcher = () =>
      Promise.resolve(
        new Response("<html><body>no structured data</body></html>", { status: 200 }),
      );

    await expect(importRecipeTinEats(RTE_URL, noRecipeFetcher)).rejects.toThrow(
      "No Schema.org Recipe JSON-LD found",
    );
  });

  test("throws when fetch returns non-200", async () => {
    const notFoundFetcher: Fetcher = () =>
      Promise.resolve(new Response("Not found", { status: 404 }));

    await expect(importRecipeTinEats(RTE_URL, notFoundFetcher)).rejects.toThrow("404");
  });

  test("first ingredient line is parsed structurally", async () => {
    const { recipe } = await importRecipeTinEats(RTE_URL, htmlFetcher("french-toast.html"));
    // "4 thick slices bread" — expect quantity 4
    const firstIng = recipe.ingredients[0];
    expect(firstIng.quantity).toBe(4);
    expect(firstIng.originalLine).toBe("4 thick slices bread");
  });
});
