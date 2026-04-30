import { beforeEach, expect, test } from "bun:test";
import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithAppRouter } from "./renderWithProviders";

beforeEach(() => {
  // Reset theme state before each test
  localStorage.removeItem("theme");
  document.documentElement.removeAttribute("data-theme");
});

async function renderApp() {
  return renderWithAppRouter({ initialUrl: "/" });
}

// AppLayout renders two toggle buttons (mobile + desktop). Use the first.
function getToggleBtn(
  getAllByRole: (role: string, options?: { name?: RegExp }) => HTMLElement[],
  name: RegExp,
) {
  const btns = getAllByRole("button", { name });
  return btns[0];
}

test("theme toggle buttons are present", async () => {
  const { getAllByRole } = await renderApp();

  await waitFor(() => {
    const btns = getAllByRole("button", { name: /switch to (light|dark) mode/i });
    expect(btns.length).toBeGreaterThanOrEqual(1);
  });
});

test("clicking toggle changes data-theme to light", async () => {
  const user = userEvent.setup();
  localStorage.setItem("theme", "dark");

  const { getAllByRole } = await renderApp();

  const toggleBtn = getToggleBtn(getAllByRole, /switch to light mode/i);
  await user.click(toggleBtn);

  await waitFor(() => {
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});

test("persists theme to localStorage after toggle", async () => {
  const user = userEvent.setup();
  localStorage.setItem("theme", "dark");

  const { getAllByRole } = await renderApp();

  const toggleBtn = getToggleBtn(getAllByRole, /switch to light mode/i);
  await user.click(toggleBtn);

  await waitFor(() => {
    expect(localStorage.getItem("theme")).toBe("light");
  });
});

test("reads initial theme from localStorage (light → dark button shown)", async () => {
  localStorage.setItem("theme", "light");

  const { getAllByRole } = await renderApp();

  await waitFor(() => {
    const btns = getAllByRole("button", { name: /switch to dark mode/i });
    expect(btns.length).toBeGreaterThanOrEqual(1);
  });
});

test("toggling back to dark mode works", async () => {
  const user = userEvent.setup();
  localStorage.setItem("theme", "light");

  const { getAllByRole } = await renderApp();

  const toggleBtn = getToggleBtn(getAllByRole, /switch to dark mode/i);
  await user.click(toggleBtn);

  await waitFor(() => {
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
  });
});
