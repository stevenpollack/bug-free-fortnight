import { createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { AppLayout } from "./layouts/AppLayout";
import { ImportFlow } from "./pages/ImportFlow";
import { RecipeCreate } from "./pages/RecipeCreate";
import { RecipeDetail } from "./pages/RecipeDetail";
import { RecipeEdit } from "./pages/RecipeEdit";
import { RecipesIndex } from "./pages/RecipesIndex";

const rootRoute = createRootRoute({
  component: AppLayout,
});

const recipesIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: RecipesIndex,
  validateSearch: z.object({
    q: z.string().optional(),
    tag: z.array(z.string()).optional(),
    favourite: z.boolean().optional(),
  }),
});

// Static segment must come before dynamic segment
const recipeNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/recipes/new",
  component: RecipeCreate,
});

const recipeDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/recipes/$id",
  component: RecipeDetail,
});

const recipeEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/recipes/$id/edit",
  component: RecipeEdit,
});

const importRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/import",
  component: ImportFlow,
});

// Catch-all redirect to home
const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "*",
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  component: () => null,
});

const routeTree = rootRoute.addChildren([
  recipesIndexRoute,
  recipeNewRoute,
  recipeDetailRoute,
  recipeEditRoute,
  importRoute,
  notFoundRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
