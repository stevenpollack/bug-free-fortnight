import { expect, test } from "bun:test";
import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { PLAN_ID, mockPlanDetail } from "./mocks/handlers";
import { server } from "./mocks/server";
import { renderWithAppRouter } from "./renderWithProviders";

async function renderPlanDetail() {
  return renderWithAppRouter({ initialUrl: `/meal-plans/${PLAN_ID}` });
}

test("renders 7 day cards (Monday through Sunday)", async () => {
  const { getByText } = await renderPlanDetail();

  await waitFor(() => {
    expect(getByText("Monday")).toBeInTheDocument();
    expect(getByText("Tuesday")).toBeInTheDocument();
    expect(getByText("Wednesday")).toBeInTheDocument();
    expect(getByText("Thursday")).toBeInTheDocument();
    expect(getByText("Friday")).toBeInTheDocument();
    expect(getByText("Saturday")).toBeInTheDocument();
    expect(getByText("Sunday")).toBeInTheDocument();
  });
});

test("shows recipe name in a filled slot", async () => {
  const { getByText } = await renderPlanDetail();

  // Monday slot has Pasta Carbonara from mockPlanDetail
  await waitFor(() => {
    expect(getByText("Pasta Carbonara")).toBeInTheDocument();
  });
});

test("shows placeholder text in empty slots", async () => {
  const { getAllByText } = await renderPlanDetail();

  // 6 empty days (tue-sun) each show "— Add dinner"
  await waitFor(() => {
    const placeholders = getAllByText("— Add dinner");
    expect(placeholders.length).toBeGreaterThanOrEqual(6);
  });
});

test("loading state renders skeleton placeholders", async () => {
  // Delay the response to catch the loading state — don't await router.load()
  // so we can observe the loading skeleton
  server.use(
    http.get("*/api/meal-plans/:id", async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
      return HttpResponse.json({ mealPlan: mockPlanDetail });
    }),
  );

  // Start loading but don't await — capture the intermediate loading state
  const renderPromise = renderPlanDetail();

  // After the router loads but before the API responds, loading skeletons show
  await waitFor(() => {
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  // Let it finish
  await renderPromise;
});

test("fetch failure renders error card", async () => {
  server.use(
    http.get("*/api/meal-plans/:id", () => {
      return HttpResponse.json(
        { error: { code: "SERVER_ERROR", message: "Fetch failed" } },
        { status: 500 },
      );
    }),
  );

  const { getByText } = await renderPlanDetail();

  await waitFor(() => {
    expect(getByText(/meal plan not found/i)).toBeInTheDocument();
  });
});

test("plan name shown in name editor input", async () => {
  const { getByPlaceholderText } = await renderPlanDetail();

  await waitFor(() => {
    const input = getByPlaceholderText(/unnamed plan/i) as HTMLInputElement;
    expect(input.value).toBe("Test Week");
  });
});

test("blurring name input with changed value triggers PATCH", async () => {
  const user = userEvent.setup();
  let patchCalled = false;

  server.use(
    http.patch("*/api/meal-plans/:id", async ({ request }) => {
      patchCalled = true;
      const body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        mealPlan: { ...mockPlanDetail, name: String(body.name) },
      });
    }),
  );

  const { findByPlaceholderText } = await renderPlanDetail();

  const input = await findByPlaceholderText(/unnamed plan/i);
  await user.clear(input);
  await user.type(input, "New Name");
  await user.tab(); // triggers blur

  await waitFor(() => {
    expect(patchCalled).toBe(true);
  });
});

test("This Week badge shown when plan is active", async () => {
  const { getByText } = await renderPlanDetail();

  await waitFor(() => {
    // The activate button shows "This Week ✓" for the active plan
    expect(getByText(/this week/i)).toBeInTheDocument();
  });
});
