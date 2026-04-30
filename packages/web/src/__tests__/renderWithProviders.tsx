import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { router as appRouter } from "../router";

// ---------------------------------------------------------------------------
// Fresh QueryClient factory — retry disabled so tests fail fast
// ---------------------------------------------------------------------------

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

// ---------------------------------------------------------------------------
// Simple wrapper for components that don't need a router (e.g. ShoppingList
// which receives planId as a prop and doesn't call useParams/Link).
// ---------------------------------------------------------------------------

interface SimpleRenderOptions {
  queryClient?: QueryClient;
}

export function renderWithQuery(
  ui: ReactNode,
  { queryClient = makeQueryClient() }: SimpleRenderOptions = {},
) {
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

// ---------------------------------------------------------------------------
// Full router wrapper for pages that use useParams / Link / useNavigate.
//
// Usage:
//   renderWithRouter(<MyPage />, { path: "/meal-plans/$id", initialUrl: "/meal-plans/abc" })
// ---------------------------------------------------------------------------

interface RouterRenderOptions {
  /** Route path pattern, e.g. "/meal-plans/$id" */
  path: string;
  /** Initial URL the router starts at */
  initialUrl: string;
  queryClient?: QueryClient;
}

export function renderWithRouter(
  ui: ReactNode,
  { path, initialUrl, queryClient = makeQueryClient() }: RouterRenderOptions,
) {
  const rootRoute = createRootRoute();

  const componentRoute = createRoute({
    getParentRoute: () => rootRoute,
    path,
    component: () => <>{ui}</>,
  });

  const routeTree = rootRoute.addChildren([componentRoute]);

  const history = createMemoryHistory({ initialEntries: [initialUrl] });

  const router = createRouter({ routeTree, history });

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Render using the REAL app router (needed for pages that use getRouteApi).
// Creates a fresh memory-history router instance each time so tests are
// independent. The app router's routeTree is shared but each test gets its
// own history/state.
// ---------------------------------------------------------------------------

interface AppRouterRenderOptions {
  initialUrl: string;
  queryClient?: QueryClient;
}

export async function renderWithAppRouter({
  initialUrl,
  queryClient = makeQueryClient(),
}: AppRouterRenderOptions) {
  const history = createMemoryHistory({ initialEntries: [initialUrl] });
  // createRouter with the real routeTree but fresh history
  const testRouter = createRouter({ routeTree: appRouter.routeTree, history });

  // router.load() resolves async route loaders / redirects before first render.
  // Without this, RouterProvider renders an empty div until the Promise resolves,
  // which is too late for test assertions that run synchronously after render().
  await testRouter.load();

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={testRouter} />
    </QueryClientProvider>,
  );
}
