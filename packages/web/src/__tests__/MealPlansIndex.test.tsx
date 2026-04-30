import { expect, test } from "bun:test";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { PLAN_ID_2, mockPlanList } from "./mocks/handlers";
import { server } from "./mocks/server";
import { renderWithAppRouter } from "./renderWithProviders";

async function renderIndex() {
  return renderWithAppRouter({ initialUrl: "/meal-plans" });
}

test("lists plan names", async () => {
  await renderIndex();

  await waitFor(() => {
    expect(screen.getByText("Test Week")).toBeInTheDocument();
    expect(screen.getByText("Another Plan")).toBeInTheDocument();
  });
});

test("active plan has This Week badge", async () => {
  await renderIndex();

  await waitFor(() => {
    // The active plan card has a "This Week" badge
    const badges = screen.getAllByText("This Week");
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });
});

test("clicking New Plan calls POST /api/meal-plans", async () => {
  const user = userEvent.setup();

  let postCalled = false;
  server.use(
    http.post("*/api/meal-plans", () => {
      postCalled = true;
      return HttpResponse.json({
        mealPlan: {
          id: "plan-new",
          name: null,
          is_active: false,
          created_at: "2026-04-30T00:00:00.000Z",
          updated_at: "2026-04-30T00:00:00.000Z",
          slots: { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null },
        },
      });
    }),
  );

  await renderIndex();

  const newPlanBtn = await screen.findByRole("button", { name: /new plan/i });
  await user.click(newPlanBtn);

  await waitFor(() => {
    expect(postCalled).toBe(true);
  });
});

test("delete plan removes it from the list", async () => {
  const user = userEvent.setup();

  let deleted = false;
  server.use(
    http.delete(`*/api/meal-plans/${PLAN_ID_2}`, () => {
      deleted = true;
      return new HttpResponse(null, { status: 204 });
    }),
    // After deletion return only the active plan
    http.get("*/api/meal-plans", () => {
      if (deleted) {
        return HttpResponse.json({ mealPlans: [mockPlanList[0]] });
      }
      return HttpResponse.json({ mealPlans: mockPlanList });
    }),
  );

  await renderIndex();

  // Confirm "Another Plan" is visible
  await screen.findByText("Another Plan");

  // Find and click the delete button for the inactive plan
  const deleteBtn = screen.getAllByRole("button", { name: /delete plan/i });
  // Should have at least one delete button
  expect(deleteBtn.length).toBeGreaterThan(0);

  // Mock window.confirm to return true
  const originalConfirm = window.confirm;
  window.confirm = () => true;

  await user.click(deleteBtn[deleteBtn.length - 1]);

  window.confirm = originalConfirm;

  await waitFor(() => {
    expect(screen.queryByText("Another Plan")).not.toBeInTheDocument();
  });
});

test("list fetch failure shows error card", async () => {
  server.use(
    http.get("*/api/meal-plans", () => {
      return HttpResponse.json(
        { error: { code: "SERVER_ERROR", message: "Failed to fetch" } },
        { status: 500 },
      );
    }),
  );

  await renderIndex();

  await waitFor(() => {
    expect(screen.getByText(/failed to load meal plans/i)).toBeInTheDocument();
  });
});

test("delete failure keeps plan in list", async () => {
  const user = userEvent.setup();

  server.use(
    http.delete(`*/api/meal-plans/${PLAN_ID_2}`, () => {
      return HttpResponse.json(
        { error: { code: "SERVER_ERROR", message: "Delete failed" } },
        { status: 500 },
      );
    }),
  );

  await renderIndex();

  await screen.findByText("Another Plan");

  const deleteBtn = screen.getAllByRole("button", { name: /delete plan/i });

  const originalConfirm = window.confirm;
  window.confirm = () => true;

  await user.click(deleteBtn[deleteBtn.length - 1]);

  window.confirm = originalConfirm;

  // Plan should still be present since delete failed
  await waitFor(() => {
    expect(screen.getByText("Another Plan")).toBeInTheDocument();
  });
});
