import { expect, mock, test } from "bun:test";
import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "./mocks/server";
import { renderWithAppRouter } from "./renderWithProviders";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function renderIndex() {
  return renderWithAppRouter({ initialUrl: "/" });
}

async function openPasteTab(
  user: ReturnType<typeof userEvent.setup>,
  utils: Awaited<ReturnType<typeof renderIndex>>,
) {
  const { getByRole, getByLabelText } = utils;

  await waitFor(() => {
    expect(getByRole("button", { name: /^generate$/i })).toBeInTheDocument();
  });

  await user.click(getByRole("button", { name: /^generate$/i }));

  // With recipeGeneration:true default, sheet opens on Generate tab.
  // Switch to Paste JSON.
  await waitFor(() => {
    expect(getByRole("button", { name: /paste json/i })).toBeInTheDocument();
  });
  await user.click(getByRole("button", { name: /paste json/i }));

  await waitFor(() => {
    expect(getByLabelText(/paste recipe json/i)).toBeInTheDocument();
  });
}

// ---------------------------------------------------------------------------
// Copy-prompt button inside Paste tab
// ---------------------------------------------------------------------------

test("copy-prompt button is visible inside Paste tab", async () => {
  const user = userEvent.setup();
  const utils = await renderIndex();

  await openPasteTab(user, utils);

  const { getByRole } = utils;
  expect(getByRole("button", { name: /copy prompt for chatgpt \/ claude/i })).toBeInTheDocument();
});

test("copy-prompt button is disabled when schema is not yet loaded", async () => {
  // Make the schema endpoint hang so it never resolves during this test
  server.use(
    http.get("*/api/schemas/recipe", () => {
      return new Promise(() => {
        /* never resolves */
      });
    }),
  );

  const user = userEvent.setup();
  const utils = await renderIndex();

  await openPasteTab(user, utils);

  const { getByRole } = utils;
  await waitFor(() => {
    expect(getByRole("button", { name: /copy prompt for chatgpt \/ claude/i })).toBeDisabled();
  });
});

test("clicking copy-prompt triggers clipboard and shows Copied label", async () => {
  // Provide a working clipboard mock
  const writeText = mock(async (_text: string) => {});
  Object.defineProperty(globalThis.navigator, "clipboard", {
    value: { writeText },
    configurable: true,
    writable: true,
  });

  const user = userEvent.setup();
  const utils = await renderIndex();

  await openPasteTab(user, utils);

  const { getByRole } = utils;

  // Wait for schema to load (button becomes enabled)
  await waitFor(() => {
    expect(getByRole("button", { name: /copy prompt for chatgpt \/ claude/i })).not.toBeDisabled();
  });

  await user.click(getByRole("button", { name: /copy prompt for chatgpt \/ claude/i }));

  // Label change confirms the copy completed
  await waitFor(() => {
    expect(getByRole("button", { name: /copied — go get your json/i })).toBeInTheDocument();
  });
});

test("copy button label flips to 'Copied' after click", async () => {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: mock(async () => {}) },
    configurable: true,
    writable: true,
  });

  const user = userEvent.setup();
  const utils = await renderIndex();

  await openPasteTab(user, utils);

  const { getByRole } = utils;

  await waitFor(() => {
    expect(getByRole("button", { name: /copy prompt for chatgpt \/ claude/i })).not.toBeDisabled();
  });

  await user.click(getByRole("button", { name: /copy prompt for chatgpt \/ claude/i }));

  await waitFor(() => {
    expect(getByRole("button", { name: /copied — go get your json/i })).toBeInTheDocument();
  });
});

test("paste textarea loses pulse class after typing", async () => {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: mock(async () => {}) },
    configurable: true,
    writable: true,
  });

  const user = userEvent.setup();
  const utils = await renderIndex();

  await openPasteTab(user, utils);

  const { getByRole, getByLabelText } = utils;

  await waitFor(() => {
    expect(getByRole("button", { name: /copy prompt for chatgpt \/ claude/i })).not.toBeDisabled();
  });

  // Click copy to trigger pulse
  await user.click(getByRole("button", { name: /copy prompt for chatgpt \/ claude/i }));

  const textarea = getByLabelText(/paste recipe json/i);
  await waitFor(() => {
    expect(textarea.className).toContain("animate-pulse");
  });

  // Type into textarea — pulse should clear
  await user.type(textarea, "x");

  await waitFor(() => {
    expect(textarea.className).not.toContain("animate-pulse");
  });
});

// ---------------------------------------------------------------------------
// Helper text
// ---------------------------------------------------------------------------

test("helper text is shown below copy button in Paste tab", async () => {
  const user = userEvent.setup();
  const utils = await renderIndex();

  await openPasteTab(user, utils);

  const { getByText } = utils;
  expect(getByText(/paste the response into the box below/i)).toBeInTheDocument();
});

// ---------------------------------------------------------------------------
// Sheet opens on Paste tab when flag is off (regression guard)
// ---------------------------------------------------------------------------

test("sheet defaults to Paste tab when recipeGeneration is disabled", async () => {
  server.use(
    http.get("*/api/config", () => {
      return HttpResponse.json({ features: { recipeGeneration: false } });
    }),
  );

  const user = userEvent.setup();
  const { getByRole, getByLabelText } = await renderIndex();

  await waitFor(() => {
    expect(getByRole("button", { name: /^generate$/i })).toBeInTheDocument();
  });

  await user.click(getByRole("button", { name: /^generate$/i }));

  await waitFor(() => {
    expect(getByLabelText(/paste recipe json/i)).toBeInTheDocument();
  });
});
