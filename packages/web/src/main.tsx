import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { logger } from "./lib/logger";
import { router } from "./router";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 60 s before data is considered stale — sensible for a household kitchen app
      staleTime: 60_000,
      // Don't re-fetch when the window regains focus (annoying while cooking)
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (err) => logger.warn({ error: (err as Error).message }, "mutation failed"),
    },
  },
});

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
