import { expect, test } from "bun:test";
import { fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockGeneratedRecipe } from "./mocks/handlers";
import { renderWithAppRouter } from "./renderWithProviders";

async function renderIndex() {
  return renderWithAppRouter({ initialUrl: "/" });
}

// Open the sheet and switch to the Paste JSON tab
async function openPasteTab(
  user: ReturnType<typeof userEvent.setup>,
  utils: Awaited<ReturnType<typeof renderIndex>>,
) {
  const { getByRole, getByLabelText } = utils;

  await waitFor(() => {
    expect(getByRole("button", { name: /^generate$/i })).toBeInTheDocument();
  });

  await user.click(getByRole("button", { name: /^generate$/i }));

  // Click the Paste JSON tab (exact match to avoid "Paste JSON from external AI" button)
  await waitFor(() => {
    expect(getByRole("button", { name: /^paste json$/i })).toBeInTheDocument();
  });
  await user.click(getByRole("button", { name: /^paste json$/i }));

  await waitFor(() => {
    expect(getByLabelText(/paste recipe json/i)).toBeInTheDocument();
  });
}

// ---------------------------------------------------------------------------
// Tab switching
// ---------------------------------------------------------------------------

test("Paste JSON tab is accessible from the Generate sheet", async () => {
  const user = userEvent.setup();
  const utils = await renderIndex();

  await openPasteTab(user, utils);

  const { getByRole } = utils;
  expect(getByRole("button", { name: /load recipe/i })).toBeInTheDocument();
});

test("Load Recipe button is disabled when textarea is empty", async () => {
  const user = userEvent.setup();
  const utils = await renderIndex();

  await openPasteTab(user, utils);

  const { getByRole } = utils;
  expect(getByRole("button", { name: /load recipe/i })).toBeDisabled();
});

// ---------------------------------------------------------------------------
// Validation errors
// ---------------------------------------------------------------------------

test("invalid JSON shows a parse error", async () => {
  const user = userEvent.setup();
  const utils = await renderIndex();

  await openPasteTab(user, utils);

  const { getByLabelText, getByRole, getByText } = utils;

  fireEvent.change(getByLabelText(/paste recipe json/i), { target: { value: "{not valid json" } });
  await user.click(getByRole("button", { name: /load recipe/i }));

  await waitFor(() => {
    expect(getByText(/invalid json/i)).toBeInTheDocument();
  });
});

test("valid JSON failing schema validation shows field errors", async () => {
  const user = userEvent.setup();
  const utils = await renderIndex();

  await openPasteTab(user, utils);

  const { getByLabelText, getByRole, getByText } = utils;

  // Missing required fields (title, ingredients, instructions)
  fireEvent.change(getByLabelText(/paste recipe json/i), { target: { value: '{"foo":"bar"}' } });
  await user.click(getByRole("button", { name: /load recipe/i }));

  await waitFor(() => {
    // Zod will surface a validation error about missing required fields
    expect(getByText(/title/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Success path
// ---------------------------------------------------------------------------

test("valid recipe JSON closes the sheet (onGenerated fires)", async () => {
  const user = userEvent.setup();
  const utils = await renderIndex();

  await openPasteTab(user, utils);

  const { getByLabelText, getByRole, queryByLabelText } = utils;

  const validJson = JSON.stringify(mockGeneratedRecipe);
  fireEvent.change(getByLabelText(/paste recipe json/i), { target: { value: validJson } });
  await user.click(getByRole("button", { name: /load recipe/i }));

  // After success, the sheet closes — the textarea disappears
  await waitFor(() => {
    expect(queryByLabelText(/paste recipe json/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Error clears on edit
// ---------------------------------------------------------------------------

test("paste error clears when textarea is edited", async () => {
  const user = userEvent.setup();
  const utils = await renderIndex();

  await openPasteTab(user, utils);

  const { getByLabelText, getByRole, queryByText } = utils;

  // Trigger an error
  fireEvent.change(getByLabelText(/paste recipe json/i), { target: { value: "bad" } });
  await user.click(getByRole("button", { name: /load recipe/i }));

  await waitFor(() => {
    expect(queryByText(/invalid json/i)).toBeInTheDocument();
  });

  // Edit the textarea — error should clear
  fireEvent.change(getByLabelText(/paste recipe json/i), { target: { value: "badx" } });

  await waitFor(() => {
    expect(queryByText(/invalid json/i)).not.toBeInTheDocument();
  });
});
