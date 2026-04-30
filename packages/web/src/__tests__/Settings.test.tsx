import { afterEach, expect, test } from "bun:test";
import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "./mocks/server";
import { renderWithAppRouter } from "./renderWithProviders";

// Clean up localStorage between tests
afterEach(() => {
  localStorage.removeItem("anthropicApiKey");
});

async function renderSettings() {
  return renderWithAppRouter({ initialUrl: "/settings" });
}

test("renders API key input and Save / Test key buttons", async () => {
  const { getByLabelText, getByRole } = await renderSettings();

  await waitFor(() => {
    expect(getByLabelText(/anthropic api key/i)).toBeInTheDocument();
    expect(getByRole("button", { name: /save/i })).toBeInTheDocument();
    expect(getByRole("button", { name: /test key/i })).toBeInTheDocument();
  });
});

test("Save stores key in localStorage", async () => {
  const user = userEvent.setup();
  const { getByLabelText, getByRole } = await renderSettings();

  await waitFor(() => {
    expect(getByLabelText(/anthropic api key/i)).toBeInTheDocument();
  });

  await user.type(getByLabelText(/anthropic api key/i), "sk-ant-test-123");
  await user.click(getByRole("button", { name: /save/i }));

  expect(localStorage.getItem("anthropicApiKey")).toBe("sk-ant-test-123");
});

test("Test key shows success indicator when API returns ok", async () => {
  const user = userEvent.setup();
  const { getByLabelText, getByRole, getByText } = await renderSettings();

  await waitFor(() => {
    expect(getByLabelText(/anthropic api key/i)).toBeInTheDocument();
  });

  await user.type(getByLabelText(/anthropic api key/i), "sk-ant-valid");
  await user.click(getByRole("button", { name: /test key/i }));

  await waitFor(() => {
    expect(getByText(/key is valid/i)).toBeInTheDocument();
  });
});

test("Test key shows error message when API returns 401", async () => {
  server.use(
    http.post("*/api/anthropic/test-key", () => {
      return HttpResponse.json(
        { error: { code: "INVALID_KEY", message: "API key is invalid or has been revoked" } },
        { status: 401 },
      );
    }),
  );

  const user = userEvent.setup();
  const { getByLabelText, getByRole, getByText } = await renderSettings();

  await waitFor(() => {
    expect(getByLabelText(/anthropic api key/i)).toBeInTheDocument();
  });

  await user.type(getByLabelText(/anthropic api key/i), "sk-ant-bad");
  await user.click(getByRole("button", { name: /test key/i }));

  await waitFor(() => {
    expect(getByText(/invalid or has been revoked/i)).toBeInTheDocument();
  });
});

test("Clear removes key from localStorage and hides Clear button", async () => {
  // Pre-seed a key
  localStorage.setItem("anthropicApiKey", "sk-ant-existing");

  const user = userEvent.setup();
  const { getByRole } = await renderSettings();

  await waitFor(() => {
    expect(getByRole("button", { name: /clear/i })).toBeInTheDocument();
  });

  await user.click(getByRole("button", { name: /clear/i }));

  expect(localStorage.getItem("anthropicApiKey")).toBeNull();
  await waitFor(() => {
    expect(getByRole("button", { name: /save/i })).toBeInTheDocument();
  });
});
