import { expect, test } from "bun:test";
import { fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { PLAN_ID } from "./mocks/handlers";
import { server } from "./mocks/server";
import { renderWithAppRouter } from "./renderWithProviders";

async function renderPlanDetail() {
  return renderWithAppRouter({ initialUrl: `/meal-plans/${PLAN_ID}` });
}

// ---------------------------------------------------------------------------
// Generate button visibility
// ---------------------------------------------------------------------------

test("Generate button is visible in MealPlanDetail header", async () => {
  const { getByRole } = await renderPlanDetail();

  await waitFor(() => {
    expect(getByRole("button", { name: /generate meal plan/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Sheet open / tab defaults
// ---------------------------------------------------------------------------

test("clicking Generate opens the sheet defaulting to Generate tab when flag is on", async () => {
  const user = userEvent.setup();
  const { getByRole, getByLabelText } = await renderPlanDetail();

  await waitFor(() => {
    expect(getByRole("button", { name: /generate meal plan/i })).toBeInTheDocument();
  });

  await user.click(getByRole("button", { name: /generate meal plan/i }));

  await waitFor(() => {
    expect(getByLabelText(/what would you like this week/i)).toBeInTheDocument();
  });
});

test("clicking Generate opens sheet defaulting to Paste JSON tab when flag is off", async () => {
  server.use(
    http.get("*/api/config", () => {
      return HttpResponse.json({ features: { recipeGeneration: false } });
    }),
  );

  const user = userEvent.setup();
  const { getByRole, getByLabelText } = await renderPlanDetail();

  await waitFor(() => {
    expect(getByRole("button", { name: /generate meal plan/i })).toBeInTheDocument();
  });

  await user.click(getByRole("button", { name: /generate meal plan/i }));

  await waitFor(() => {
    expect(getByLabelText(/paste meal plan json/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Generate tab — disabled state
// ---------------------------------------------------------------------------

test("Generate Plan button is disabled when prompt is empty", async () => {
  const user = userEvent.setup();
  const { getByRole } = await renderPlanDetail();

  await waitFor(() => {
    expect(getByRole("button", { name: /generate meal plan/i })).toBeInTheDocument();
  });

  await user.click(getByRole("button", { name: /generate meal plan/i }));

  await waitFor(() => {
    const btn = getByRole("button", { name: /generate plan/i });
    expect(btn).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Generate tab — loading state
// ---------------------------------------------------------------------------

test("loading state shown while generating (prompt path)", async () => {
  let resolveGenerate: (() => void) | undefined;
  const hangingPromise = new Promise<void>((resolve) => {
    resolveGenerate = resolve;
  });

  server.use(
    http.post("*/api/meal-plans/generate", async () => {
      await hangingPromise;
      return HttpResponse.json({ ok: true, slotCount: 5 });
    }),
  );

  const user = userEvent.setup();
  const { getByRole, getByLabelText, getByText, queryByRole } = await renderPlanDetail();

  await waitFor(() => {
    expect(getByRole("button", { name: /generate meal plan/i })).toBeInTheDocument();
  });

  await user.click(getByRole("button", { name: /generate meal plan/i }));

  await waitFor(() => {
    expect(getByLabelText(/what would you like this week/i)).toBeInTheDocument();
  });

  await user.type(getByLabelText(/what would you like this week/i), "5 weeknight dinners");
  await user.click(getByRole("button", { name: /generate plan/i }));

  await waitFor(() => {
    expect(getByText(/planning your week/i)).toBeInTheDocument();
    expect(queryByRole("button", { name: /close/i })).not.toBeInTheDocument();
  });

  resolveGenerate?.();
});

// ---------------------------------------------------------------------------
// Generate tab — error state
// ---------------------------------------------------------------------------

test("error banner shown when generation fails", async () => {
  server.use(
    http.post("*/api/meal-plans/generate", () => {
      return HttpResponse.json(
        { error: { code: "GENERATION_FAILED", message: "Something went wrong" } },
        { status: 422 },
      );
    }),
  );

  const user = userEvent.setup();
  const { getByRole, getByLabelText, getByText } = await renderPlanDetail();

  await waitFor(() => {
    expect(getByRole("button", { name: /generate meal plan/i })).toBeInTheDocument();
  });

  await user.click(getByRole("button", { name: /generate meal plan/i }));

  await waitFor(() => {
    expect(getByLabelText(/what would you like this week/i)).toBeInTheDocument();
  });

  await user.type(getByLabelText(/what would you like this week/i), "5 weeknight dinners");
  await user.click(getByRole("button", { name: /generate plan/i }));

  await waitFor(() => {
    expect(getByText(/something went wrong/i)).toBeInTheDocument();
    expect(getByRole("button", { name: /close/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Paste tab — copy prompt button
// ---------------------------------------------------------------------------

test("Paste JSON tab has a copy prompt button", async () => {
  const user = userEvent.setup();
  const { getByRole } = await renderPlanDetail();

  await waitFor(() => {
    expect(getByRole("button", { name: /generate meal plan/i })).toBeInTheDocument();
  });

  await user.click(getByRole("button", { name: /generate meal plan/i }));

  // Switch to Paste JSON tab
  await waitFor(() => {
    expect(getByRole("button", { name: /paste json/i })).toBeInTheDocument();
  });
  await user.click(getByRole("button", { name: /paste json/i }));

  await waitFor(() => {
    expect(getByRole("button", { name: /copy prompt/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Paste tab — Apply Plan
// ---------------------------------------------------------------------------

test("Apply Plan button submits rawJson and closes sheet on success", async () => {
  const user = userEvent.setup();
  const { getByRole, getByLabelText, queryByLabelText } = await renderPlanDetail();

  await waitFor(() => {
    expect(getByRole("button", { name: /generate meal plan/i })).toBeInTheDocument();
  });

  await user.click(getByRole("button", { name: /generate meal plan/i }));

  // Switch to Paste JSON tab
  await waitFor(() => {
    expect(getByRole("button", { name: /paste json/i })).toBeInTheDocument();
  });
  await user.click(getByRole("button", { name: /paste json/i }));

  await waitFor(() => {
    expect(getByLabelText(/paste meal plan json/i)).toBeInTheDocument();
  });

  const validJson = JSON.stringify({
    slots: [{ type: "existing", day: "mon", recipeId: "recipe-1" }],
  });

  fireEvent.change(getByLabelText(/paste meal plan json/i), { target: { value: validJson } });
  await user.click(getByRole("button", { name: /apply plan/i }));

  // Sheet closes on success
  await waitFor(() => {
    expect(queryByLabelText(/paste meal plan json/i)).not.toBeInTheDocument();
  });
});

test("Paste tab shows error banner when generate endpoint returns error", async () => {
  server.use(
    http.post("*/api/meal-plans/generate", () => {
      return HttpResponse.json(
        { error: { code: "GENERATION_INVALID_REFERENCE", message: "Unknown recipe ID" } },
        { status: 422 },
      );
    }),
  );

  const user = userEvent.setup();
  const { getByRole, getByLabelText, getByText } = await renderPlanDetail();

  await waitFor(() => {
    expect(getByRole("button", { name: /generate meal plan/i })).toBeInTheDocument();
  });

  await user.click(getByRole("button", { name: /generate meal plan/i }));

  await waitFor(() => {
    expect(getByRole("button", { name: /paste json/i })).toBeInTheDocument();
  });
  await user.click(getByRole("button", { name: /paste json/i }));

  await waitFor(() => {
    expect(getByLabelText(/paste meal plan json/i)).toBeInTheDocument();
  });

  fireEvent.change(getByLabelText(/paste meal plan json/i), {
    target: { value: '{"slots":[{"type":"existing","day":"mon","recipeId":"fake-id"}]}' },
  });
  await user.click(getByRole("button", { name: /apply plan/i }));

  await waitFor(() => {
    expect(getByText(/unknown recipe id/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Sheet close
// ---------------------------------------------------------------------------

test("X button closes the sheet", async () => {
  const user = userEvent.setup();
  const { getByRole, queryByRole } = await renderPlanDetail();

  await waitFor(() => {
    expect(getByRole("button", { name: /generate meal plan/i })).toBeInTheDocument();
  });

  await user.click(getByRole("button", { name: /generate meal plan/i }));

  await waitFor(() => {
    expect(getByRole("button", { name: /close/i })).toBeInTheDocument();
  });

  await user.click(getByRole("button", { name: /close/i }));

  await waitFor(() => {
    expect(queryByRole("button", { name: /close/i })).not.toBeInTheDocument();
  });
});
