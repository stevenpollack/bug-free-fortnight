/// <reference lib="dom" />

import { describe, expect, test } from "bun:test";
import { renderWithAppRouter } from "./renderWithProviders";

describe("RecipeCreate back navigation", () => {
  test("shows a back link to recipes list", async () => {
    const { findByRole } = await renderWithAppRouter({ initialUrl: "/recipes/new" });

    const backLink = await findByRole("link", { name: /← Recipes/i });
    expect(backLink).toBeTruthy();
    expect(backLink.getAttribute("href")).toBe("/");
  });
});

describe("RecipeEdit back navigation", () => {
  test("shows a back link with the recipe title", async () => {
    const { findByRole } = await renderWithAppRouter({ initialUrl: "/recipes/recipe-1/edit" });

    const backLink = await findByRole("link", { name: /← Pasta Carbonara/i });
    expect(backLink).toBeTruthy();
    expect(backLink.getAttribute("href")).toBe("/recipes/recipe-1");
  });
});
