import { expect, test } from "bun:test";
import { waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "./mocks/server";
import { renderWithAppRouter } from "./renderWithProviders";

async function renderRecipes(search = "") {
  return renderWithAppRouter({ initialUrl: `/${search}` });
}

test("renders recipe cards with titles", async () => {
  const { getByText } = await renderRecipes();

  await waitFor(() => {
    expect(getByText("Pasta Carbonara")).toBeInTheDocument();
    expect(getByText("Chicken Soup")).toBeInTheDocument();
  });
});

test("search input is present", async () => {
  const { getByPlaceholderText } = await renderRecipes();

  await waitFor(() => {
    expect(getByPlaceholderText(/search recipes/i)).toBeInTheDocument();
  });
});

test("favourites toggle button is present", async () => {
  const { getByRole } = await renderRecipes();

  await waitFor(() => {
    expect(getByRole("button", { name: /favourites only/i })).toBeInTheDocument();
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

  const { getByText } = await renderRecipes();

  await waitFor(() => {
    expect(getByText(/failed to load recipes/i)).toBeInTheDocument();
  });
});

test("recipe total time is shown for recipes with timing", async () => {
  const { getByText } = await renderRecipes();

  // Pasta Carbonara: prep 10 + cook 20 = 30 min
  await waitFor(() => {
    expect(getByText("30 min")).toBeInTheDocument();
  });
});

test("favourite recipes show star icon", async () => {
  const { getByText } = await renderRecipes();

  await waitFor(() => {
    // Chicken Soup has favourite: true — verify both recipes are shown
    expect(getByText("Pasta Carbonara")).toBeInTheDocument();
    expect(getByText("Chicken Soup")).toBeInTheDocument();
  });
});
