import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { BookOpenIcon, DownloadIcon, PlusIcon } from "../components/icons";
import { useInstallPrompt } from "../lib/installPrompt";

function isActive(current: string, path: string) {
  if (path === "/") return current === "/";
  return current.startsWith(path);
}

function InstallButton({ className }: { className?: string }) {
  const { canInstall, install } = useInstallPrompt();
  if (!canInstall) return null;
  return (
    <button
      type="button"
      onClick={install}
      className={
        className ??
        "flex items-center gap-1.5 rounded-lg border border-amber-600 text-amber-700 dark:text-amber-400 px-3 py-2 text-sm font-medium min-h-11 transition-colors hover:bg-amber-50 dark:hover:bg-amber-900/30 active:bg-amber-100"
      }
    >
      Install
    </button>
  );
}

export function AppLayout() {
  const navigate = useNavigate();
  const { location } = useRouterState();
  const currentPath = location.pathname;

  return (
    <div className="min-h-dvh flex flex-col bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      {/* Top app bar — visible on mobile, hidden on md+ to feel less mobile-y */}
      <header className="md:hidden sticky top-0 z-30 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-700 safe-top">
        <div className="flex items-center justify-between px-4 h-14 max-w-screen-md mx-auto gap-2">
          <Link
            to="/"
            className="text-lg font-bold text-amber-700 dark:text-amber-400 leading-none"
          >
            Family Recipes
          </Link>
          <div className="flex items-center gap-2">
            <InstallButton />
            <button
              type="button"
              onClick={() => navigate({ to: "/recipes/new" })}
              aria-label="New recipe"
              className="flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white px-3 py-2 text-sm font-medium min-h-11 transition-colors"
            >
              <PlusIcon className="size-4" />
              New
            </button>
          </div>
        </div>
      </header>

      {/* Desktop top bar */}
      <header className="hidden md:block sticky top-0 z-30 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-700">
        <div className="flex items-center justify-between px-6 h-16 max-w-screen-md mx-auto">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-xl font-bold text-amber-700 dark:text-amber-400">
              Family Recipes
            </Link>
            <nav className="flex gap-1">
              <Link
                to="/"
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive(currentPath, "/") && !isActive(currentPath, "/import")
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                    : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
                }`}
              >
                Recipes
              </Link>
              <Link
                to="/import"
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive(currentPath, "/import")
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                    : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
                }`}
              >
                Import
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <InstallButton />
            <button
              type="button"
              onClick={() => navigate({ to: "/recipes/new" })}
              aria-label="New recipe"
              className="flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white px-3 py-2 text-sm font-medium transition-colors"
            >
              <PlusIcon className="size-4" />
              New Recipe
            </button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 pb-24 md:pb-8 pt-4">
        <Outlet />
      </main>

      {/* Bottom nav — mobile only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-700 safe-bottom">
        <div className="flex items-stretch h-16">
          <Link
            to="/"
            className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors min-h-11 ${
              isActive(currentPath, "/") && !isActive(currentPath, "/import")
                ? "text-amber-700 dark:text-amber-400"
                : "text-stone-500 dark:text-stone-400"
            }`}
          >
            <BookOpenIcon className="size-6" />
            Recipes
          </Link>
          <Link
            to="/import"
            className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors min-h-11 ${
              isActive(currentPath, "/import")
                ? "text-amber-700 dark:text-amber-400"
                : "text-stone-500 dark:text-stone-400"
            }`}
          >
            <DownloadIcon className="size-6" />
            Import
          </Link>
        </div>
      </nav>
    </div>
  );
}
