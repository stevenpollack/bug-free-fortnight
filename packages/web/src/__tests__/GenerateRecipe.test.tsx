import { expect, test } from "bun:test";
import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { mockGeneratedRecipe } from "./mocks/handlers";
import { server } from "./mocks/server";
import { renderWithAppRouter } from "./renderWithProviders";

// Helper to render the recipes index page (where Generate button lives)
async function renderIndex() {
  return renderWithAppRouter({ initialUrl: "/" });
}

// ---------------------------------------------------------------------------
// Feature flag tests
// ---------------------------------------------------------------------------

test("Generate button is always rendered; opens sheet defaulting to Paste JSON when flag is off", async () => {
  server.use(
    http.get("*/api/config", () => {
      return HttpResponse.json({ features: { recipeGeneration: false } });
    }),
  );

  const user = userEvent.setup();
  const { getByRole, getByLabelText } = await renderIndex();

  await waitFor(() => {
    // New Recipe button should be present
    expect(getByRole("link", { name: /new recipe/i })).toBeInTheDocument();
    // Generate button is also present
    expect(getByRole("button", { name: /^generate$/i })).toBeInTheDocument();
  });

  await user.click(getByRole("button", { name: /^generate$/i }));

  // Sheet opens on Paste JSON tab since generation is unavailable
  await waitFor(() => {
    expect(getByLabelText(/paste recipe json/i)).toBeInTheDocument();
  });
});

test("Generate button is rendered when recipeGeneration flag is on", async () => {
  const { getByRole } = await renderIndex();

  await waitFor(() => {
    expect(getByRole("button", { name: /generate/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Sheet open/close tests
// ---------------------------------------------------------------------------

test("clicking Generate opens the sheet with form inputs", async () => {
  const user = userEvent.setup();
  const { getByRole, getByLabelText } = await renderIndex();

  await waitFor(() => {
    expect(getByRole("button", { name: /generate/i })).toBeInTheDocument();
  });

  await user.click(getByRole("button", { name: /generate/i }));

  await waitFor(() => {
    expect(getByLabelText(/what recipe would you like/i)).toBeInTheDocument();
    expect(getByLabelText(/servings/i)).toBeInTheDocument();
    expect(getByLabelText(/dietary requirements/i)).toBeInTheDocument();
  });
});

test("Generate Recipe button in sheet is disabled when prompt is empty", async () => {
  const user = userEvent.setup();
  const { getByRole } = await renderIndex();

  await waitFor(() => {
    expect(getByRole("button", { name: /generate/i })).toBeInTheDocument();
  });

  await user.click(getByRole("button", { name: /^generate$/i }));

  await waitFor(() => {
    const submitBtn = getByRole("button", { name: /generate recipe/i });
    expect(submitBtn).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Loading state test
// ---------------------------------------------------------------------------

test("loading state is shown while generating", async () => {
  // Make the generate endpoint hang for a moment
  let resolveGenerate: (() => void) | undefined;
  const hangingPromise = new Promise<void>((resolve) => {
    resolveGenerate = resolve;
  });

  server.use(
    http.post("*/api/recipes/generate", async () => {
      await hangingPromise;
      return HttpResponse.json({ recipe: mockGeneratedRecipe });
    }),
  );

  const user = userEvent.setup();
  const { getByRole, queryByRole, getByLabelText, getByText } = await renderIndex();

  await waitFor(() => {
    expect(getByRole("button", { name: /^generate$/i })).toBeInTheDocument();
  });

  await user.click(getByRole("button", { name: /^generate$/i }));

  await waitFor(() => {
    expect(getByLabelText(/what recipe would you like/i)).toBeInTheDocument();
  });

  await user.type(getByLabelText(/what recipe would you like/i), "A simple pasta");

  await user.click(getByRole("button", { name: /generate recipe/i }));

  // Loading state shown — X button hidden during loading
  await waitFor(() => {
    expect(getByText(/thinking through your recipe/i)).toBeInTheDocument();
    expect(queryByRole("button", { name: /close/i })).not.toBeInTheDocument();
  });

  // Resolve the hanging request
  resolveGenerate?.();
});

// ---------------------------------------------------------------------------
// Error state test
// ---------------------------------------------------------------------------

test("error banner shown when generation fails (500)", async () => {
  server.use(
    http.post("*/api/recipes/generate", () => {
      return HttpResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
        { status: 500 },
      );
    }),
  );

  const user = userEvent.setup();
  const { getByRole, getByLabelText, getByText } = await renderIndex();

  await waitFor(() => {
    expect(getByRole("button", { name: /^generate$/i })).toBeInTheDocument();
  });

  await user.click(getByRole("button", { name: /^generate$/i }));

  await waitFor(() => {
    expect(getByLabelText(/what recipe would you like/i)).toBeInTheDocument();
  });

  await user.type(getByLabelText(/what recipe would you like/i), "A simple pasta");
  await user.click(getByRole("button", { name: /generate recipe/i }));

  await waitFor(() => {
    // Error message shown
    expect(getByText(/something went wrong/i)).toBeInTheDocument();
    // X button restored
    expect(getByRole("button", { name: /close/i })).toBeInTheDocument();
    // Form is restored
    expect(getByRole("button", { name: /generate recipe/i })).toBeInTheDocument();
  });
});

test("error banner mentions configuration for 503 response", async () => {
  server.use(
    http.post("*/api/recipes/generate", () => {
      return HttpResponse.json(
        {
          error: {
            code: "GENERATION_UNAVAILABLE",
            message: "Recipe generation is not configured",
          },
        },
        { status: 503 },
      );
    }),
  );

  const user = userEvent.setup();
  const { getByRole, getByLabelText, getByText } = await renderIndex();

  await waitFor(() => {
    expect(getByRole("button", { name: /^generate$/i })).toBeInTheDocument();
  });

  await user.click(getByRole("button", { name: /^generate$/i }));

  await waitFor(() => {
    expect(getByLabelText(/what recipe would you like/i)).toBeInTheDocument();
  });

  await user.type(getByLabelText(/what recipe would you like/i), "A simple pasta");
  await user.click(getByRole("button", { name: /generate recipe/i }));

  await waitFor(() => {
    expect(getByText(/not configured/i)).toBeInTheDocument();
  });
});
