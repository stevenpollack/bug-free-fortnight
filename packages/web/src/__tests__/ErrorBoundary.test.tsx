import { expect, mock, test } from "bun:test";
import { waitFor } from "@testing-library/react";
import type React from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";
import * as loggerModule from "../lib/logger";
import { renderWithQuery } from "./renderWithProviders";

// Component that throws on render
function BrokenComponent({ message }: { message: string }): React.ReactElement {
  throw new Error(message);
}

// Suppress React's expected console.error for error boundaries in tests
const originalConsoleError = console.error;
function suppressReactBoundaryLogs() {
  console.error = (msg: unknown, ...rest: unknown[]) => {
    if (
      typeof msg === "string" &&
      (msg.includes("Error boundary") ||
        msg.includes("The above error occurred") ||
        msg.includes("act(") ||
        msg.includes("React will try"))
    ) {
      return;
    }
    originalConsoleError(msg, ...rest);
  };
}

test("renders fallback when child throws", async () => {
  suppressReactBoundaryLogs();

  const { getByText } = renderWithQuery(
    <ErrorBoundary>
      <BrokenComponent message="Test error message" />
    </ErrorBoundary>,
  );

  console.error = originalConsoleError;

  await waitFor(() => {
    expect(getByText(/something went wrong/i)).toBeInTheDocument();
  });
});

test("fallback shows the error message", async () => {
  suppressReactBoundaryLogs();

  const { getByText } = renderWithQuery(
    <ErrorBoundary>
      <BrokenComponent message="My specific error" />
    </ErrorBoundary>,
  );

  console.error = originalConsoleError;

  await waitFor(() => {
    expect(getByText(/my specific error/i)).toBeInTheDocument();
  });
});

test("fallback shows Reload button", async () => {
  suppressReactBoundaryLogs();

  const { getByRole } = renderWithQuery(
    <ErrorBoundary>
      <BrokenComponent message="Boom" />
    </ErrorBoundary>,
  );

  console.error = originalConsoleError;

  await waitFor(() => {
    expect(getByRole("button", { name: /reload/i })).toBeInTheDocument();
  });
});

test("error is logged via logger.error when child throws", async () => {
  suppressReactBoundaryLogs();

  const errorSpy = mock(() => {});
  const originalError = loggerModule.logger.error;
  // biome-ignore lint/suspicious/noExplicitAny: spy overwrite
  (loggerModule.logger as any).error = errorSpy;

  renderWithQuery(
    <ErrorBoundary>
      <BrokenComponent message="Logged error" />
    </ErrorBoundary>,
  );

  // biome-ignore lint/suspicious/noExplicitAny: restore
  (loggerModule.logger as any).error = originalError;
  console.error = originalConsoleError;

  await waitFor(() => {
    expect(errorSpy).toHaveBeenCalled();
  });
});

test("window error event calls logger.error", async () => {
  const errorSpy = mock(() => {});
  const originalError = loggerModule.logger.error;
  // biome-ignore lint/suspicious/noExplicitAny: spy overwrite
  (loggerModule.logger as any).error = errorSpy;

  // Mount the ErrorBoundary so the window listener is registered
  renderWithQuery(
    <ErrorBoundary>
      <div>ok</div>
    </ErrorBoundary>,
  );

  // Dispatch a window error event
  window.dispatchEvent(
    new ErrorEvent("error", { message: "uncaught window error", error: new Error("oops") }),
  );

  // biome-ignore lint/suspicious/noExplicitAny: restore
  (loggerModule.logger as any).error = originalError;

  await waitFor(() => {
    expect(errorSpy).toHaveBeenCalled();
  });
});

test("unhandledrejection event calls logger.error", async () => {
  const errorSpy = mock(() => {});
  const originalError = loggerModule.logger.error;
  // biome-ignore lint/suspicious/noExplicitAny: spy overwrite
  (loggerModule.logger as any).error = errorSpy;

  renderWithQuery(
    <ErrorBoundary>
      <div>ok</div>
    </ErrorBoundary>,
  );

  // Dispatch unhandledrejection — happy-dom may not have PromiseRejectionEvent,
  // so use a plain Event with a reason property attached.
  // Suppress the unhandled rejection from the promise we create here.
  const p = Promise.reject(new Error("unhandled"));
  p.catch(() => {}); // suppress unhandled rejection warning
  const evt = Object.assign(new Event("unhandledrejection"), {
    reason: new Error("unhandled rejection reason"),
    promise: p,
  });
  window.dispatchEvent(evt);

  // biome-ignore lint/suspicious/noExplicitAny: restore
  (loggerModule.logger as any).error = originalError;

  await waitFor(() => {
    expect(errorSpy).toHaveBeenCalled();
  });
});
