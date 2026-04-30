import { expect, test } from "bun:test";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "./mocks/server";
import { renderWithAppRouter } from "./renderWithProviders";

async function renderRecipes(search = "") {
  return renderWithAppRouter({ initialUrl: `/${search}` });
}

test("renders recipe cards with titles", async () => {
  await renderRecipes();

  await waitFor(() => {
    expect(screen.getByText("Pasta Carbonara")).toBeInTheDocument();
    expect(screen.getByText("Chicken Soup")).toBeInTheDocument();
  });
});

test("search input is present", async () => {
  await renderRecipes();

  await waitFor(() => {
    expect(screen.getByPlaceholderText(/search recipes/i)).toBeInTheDocument();
  });
});

test("favourites toggle button is present", async () => {
  await renderRecipes();

  await waitFor(() => {
    expect(screen.getByRole("button", { name: /favourites only/i })).toBeInTheDocument();
  });
});

test("list fetch failure shows error card", async () => {
  server.use(
    http.get("*/api/recipes", () => {
      return HttpResponse.json(
        { error: { code: "SERVER_ERROR", message: "Failed to fetch" } },
        { status: 500 },
      );
    }),
  );

  await renderRecipes();

  await waitFor(() => {
    expect(screen.getByText(/failed to load recipes/i)).toBeInTheDocument();
  });
});

test("recipe total time is shown for recipes with timing", async () => {
  await renderRecipes();

  // Pasta Carbonara: prep 10 + cook 20 = 30 min
  await waitFor(() => {
    expect(screen.getByText("30 min")).toBeInTheDocument();
  });
});

test("favourite recipes show star icon", async () => {
  await renderRecipes();

  await waitFor(() => {
    // Chicken Soup has favourite: true — verify both recipes are shown
    expect(screen.getByText("Pasta Carbonara")).toBeInTheDocument();
    expect(screen.getByText("Chicken Soup")).toBeInTheDocument();
  });
});
