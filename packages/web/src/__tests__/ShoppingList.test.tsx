import { expect, test } from "bun:test";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { ShoppingList } from "../components/ShoppingList";
import { PLAN_ID, mockShoppingList } from "./mocks/handlers";
import { server } from "./mocks/server";
import { renderWithQuery } from "./renderWithProviders";

function render() {
  return renderWithQuery(<ShoppingList planId={PLAN_ID} />);
}

// Helper for the list-already-loaded case
function withExistingList() {
  server.use(
    http.get("*/api/meal-plans/:id/shopping-list", () => {
      return HttpResponse.json({
        shoppingList: mockShoppingList,
        plan_updated_at: mockShoppingList.plan_snapshot_at,
      });
    }),
  );
}

test("shows Generate button and prompt when no list exists", async () => {
  render();
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /generate/i })).toBeInTheDocument();
    expect(screen.getByText(/generate a shopping list/i)).toBeInTheDocument();
  });
});

test("clicking Generate shows items and Regenerate button", async () => {
  const user = userEvent.setup();
  render();

  const btn = await screen.findByRole("button", { name: /^generate$/i });
  await user.click(btn);

  await waitFor(() => {
    expect(screen.getByRole("button", { name: /regenerate/i })).toBeInTheDocument();
    // Items rendered as "200 g Spaghetti" (quantity + unit + name)
    expect(screen.getByText(/spaghetti/i)).toBeInTheDocument();
    expect(screen.getByText(/eggs/i)).toBeInTheDocument();
  });
});

test("checking an item shows it as checked (Uncheck aria-label)", async () => {
  const user = userEvent.setup();

  // Override GET to return checked state after PATCH so the refetch keeps it checked
  let checked = false;
  server.use(
    http.get("*/api/meal-plans/:id/shopping-list", () => {
      return HttpResponse.json({
        shoppingList: {
          ...mockShoppingList,
          items: mockShoppingList.items.map((i) => (i.id === "item-1" ? { ...i, checked } : i)),
        },
        plan_updated_at: mockShoppingList.plan_snapshot_at,
      });
    }),
    http.patch("*/api/meal-plans/:planId/shopping-list/items/:itemId", async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      if (body.checked === true) checked = true;
      const item =
        mockShoppingList.items.find((i) => i.id === "item-1") ?? mockShoppingList.items[0];
      return HttpResponse.json({ item: { ...item, checked } });
    }),
  );

  render();

  await screen.findByText(/spaghetti/i);

  const checkBtn = screen.getByRole("button", { name: /^check spaghetti$/i });
  await user.click(checkBtn);

  await waitFor(() => {
    expect(screen.getByRole("button", { name: /^uncheck spaghetti$/i })).toBeInTheDocument();
  });
});

test("unchecking a checked item reverts it to unchecked", async () => {
  const user = userEvent.setup();

  let checkedState = true;
  server.use(
    http.get("*/api/meal-plans/:id/shopping-list", () => {
      return HttpResponse.json({
        shoppingList: {
          ...mockShoppingList,
          items: mockShoppingList.items.map((i) =>
            i.id === "item-1" ? { ...i, checked: checkedState } : i,
          ),
        },
        plan_updated_at: mockShoppingList.plan_snapshot_at,
      });
    }),
    http.patch("*/api/meal-plans/:planId/shopping-list/items/:itemId", async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      if (body.checked === false) checkedState = false;
      const item =
        mockShoppingList.items.find((i) => i.id === "item-1") ?? mockShoppingList.items[0];
      return HttpResponse.json({ item: { ...item, checked: checkedState } });
    }),
  );

  render();

  // Initially checked
  await screen.findByRole("button", { name: /^uncheck spaghetti$/i });

  await user.click(screen.getByRole("button", { name: /^uncheck spaghetti$/i }));

  await waitFor(() => {
    expect(screen.getByRole("button", { name: /^check spaghetti$/i })).toBeInTheDocument();
  });
});

test("adding a custom item shows it in the list", async () => {
  const user = userEvent.setup();
  withExistingList();

  render();

  await screen.findByText(/spaghetti/i);

  const addBtn = screen.getByRole("button", { name: /add custom item/i });
  await user.click(addBtn);

  const input = screen.getByPlaceholderText(/add item/i);
  await user.type(input, "Olive oil");

  const submitBtn = screen.getByRole("button", { name: /^add$/i });
  await user.click(submitBtn);

  await waitFor(() => {
    expect(screen.getByText(/olive oil/i)).toBeInTheDocument();
  });
});

test("deleting an item removes it from the list", async () => {
  const user = userEvent.setup();
  withExistingList();

  render();

  await screen.findByText(/spaghetti/i);

  const removeBtn = screen.getByRole("button", { name: /remove spaghetti/i });
  await user.click(removeBtn);

  await waitFor(() => {
    expect(screen.queryByText(/^200 g Spaghetti$/)).not.toBeInTheDocument();
  });
});

test("shows staleness banner when plan updated after list generated", async () => {
  server.use(
    http.get("*/api/meal-plans/:id/shopping-list", () => {
      return HttpResponse.json({
        shoppingList: mockShoppingList,
        // plan updated AFTER snapshot — so list is stale
        plan_updated_at: "2026-04-02T00:00:00.000Z",
      });
    }),
  );

  render();

  await waitFor(() => {
    expect(screen.getByText(/meal plan has changed/i)).toBeInTheDocument();
  });
});

test("Generate failure: items do not appear", async () => {
  server.use(
    http.post("*/api/meal-plans/:id/shopping-list/generate", () => {
      return HttpResponse.json(
        { error: { code: "SERVER_ERROR", message: "Internal server error" } },
        { status: 500 },
      );
    }),
  );

  const user = userEvent.setup();
  render();

  const btn = await screen.findByRole("button", { name: /^generate$/i });
  await user.click(btn);

  // After failure the list should still be null — no items appear
  await waitFor(() => {
    expect(screen.queryByText(/spaghetti/i)).not.toBeInTheDocument();
  });
  // The Generate button is still present
  expect(screen.getByRole("button", { name: /^generate$/i })).toBeInTheDocument();
});

test("toggle failure reverts optimistic update", async () => {
  const user = userEvent.setup();

  server.use(
    http.get("*/api/meal-plans/:id/shopping-list", () => {
      return HttpResponse.json({
        shoppingList: mockShoppingList,
        plan_updated_at: mockShoppingList.plan_snapshot_at,
      });
    }),
    http.patch("*/api/meal-plans/:planId/shopping-list/items/:itemId", () => {
      return HttpResponse.json(
        { error: { code: "SERVER_ERROR", message: "Toggle failed" } },
        { status: 500 },
      );
    }),
  );

  render();

  await screen.findByText(/spaghetti/i);

  // Initially unchecked
  expect(screen.getByRole("button", { name: /^check spaghetti$/i })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /^check spaghetti$/i }));

  // After patch fails, optimistic update rolls back to "check" (unchecked) state
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /^check spaghetti$/i })).toBeInTheDocument();
  });
});
