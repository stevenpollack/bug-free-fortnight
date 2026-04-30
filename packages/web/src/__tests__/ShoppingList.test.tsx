import { expect, test } from "bun:test";
import { waitFor } from "@testing-library/react";
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
  const { getByRole, getByText } = render();
  await waitFor(() => {
    expect(getByRole("button", { name: /generate/i })).toBeInTheDocument();
    expect(getByText(/generate a shopping list/i)).toBeInTheDocument();
  });
});

test("clicking Generate shows items and Regenerate button", async () => {
  const user = userEvent.setup();
  const { findByRole, getByRole, getByText } = render();

  const btn = await findByRole("button", { name: /^generate$/i });
  await user.click(btn);

  await waitFor(() => {
    expect(getByRole("button", { name: /regenerate/i })).toBeInTheDocument();
    // Items rendered as "200 g Spaghetti" (quantity + unit + name)
    expect(getByText(/spaghetti/i)).toBeInTheDocument();
    expect(getByText(/eggs/i)).toBeInTheDocument();
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

  const { findByText, getByRole } = render();

  await findByText(/spaghetti/i);

  const checkBtn = getByRole("button", { name: /^check spaghetti$/i });
  await user.click(checkBtn);

  await waitFor(() => {
    expect(getByRole("button", { name: /^uncheck spaghetti$/i })).toBeInTheDocument();
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

  const { findByRole, getByRole } = render();

  // Initially checked
  await findByRole("button", { name: /^uncheck spaghetti$/i });

  await user.click(getByRole("button", { name: /^uncheck spaghetti$/i }));

  await waitFor(() => {
    expect(getByRole("button", { name: /^check spaghetti$/i })).toBeInTheDocument();
  });
});

test("adding a custom item shows it in the list", async () => {
  const user = userEvent.setup();
  withExistingList();

  const { findByText, getByRole, getByPlaceholderText, getByText } = render();

  await findByText(/spaghetti/i);

  const addBtn = getByRole("button", { name: /add custom item/i });
  await user.click(addBtn);

  const input = getByPlaceholderText(/add item/i);
  await user.type(input, "Olive oil");

  const submitBtn = getByRole("button", { name: /^add$/i });
  await user.click(submitBtn);

  await waitFor(() => {
    expect(getByText(/olive oil/i)).toBeInTheDocument();
  });
});

test("deleting an item removes it from the list", async () => {
  const user = userEvent.setup();
  withExistingList();

  const { findByText, getByRole, queryByText } = render();

  await findByText(/spaghetti/i);

  const removeBtn = getByRole("button", { name: /remove spaghetti/i });
  await user.click(removeBtn);

  await waitFor(() => {
    expect(queryByText(/^200 g Spaghetti$/)).not.toBeInTheDocument();
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

  const { getByText } = render();

  await waitFor(() => {
    expect(getByText(/meal plan has changed/i)).toBeInTheDocument();
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
  const { findByRole, queryByText, getByRole } = render();

  const btn = await findByRole("button", { name: /^generate$/i });
  await user.click(btn);

  // After failure the list should still be null — no items appear
  await waitFor(() => {
    expect(queryByText(/spaghetti/i)).not.toBeInTheDocument();
  });
  // The Generate button is still present
  expect(getByRole("button", { name: /^generate$/i })).toBeInTheDocument();
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

  const { findByText, getByRole } = render();

  await findByText(/spaghetti/i);

  // Initially unchecked
  expect(getByRole("button", { name: /^check spaghetti$/i })).toBeInTheDocument();

  await user.click(getByRole("button", { name: /^check spaghetti$/i }));

  // After patch fails, optimistic update rolls back to "check" (unchecked) state
  await waitFor(() => {
    expect(getByRole("button", { name: /^check spaghetti$/i })).toBeInTheDocument();
  });
});
