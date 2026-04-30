import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { BookOpenIcon, CalendarIcon, DownloadIcon, MoonIcon, SunIcon } from "../components/icons";
import { useInstallPrompt } from "../lib/installPrompt";
import { useTheme } from "../lib/useTheme";

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
        "flex items-center gap-1.5 rounded-lg border border-(--recipe-primary) text-(--recipe-primary) px-3 py-2 text-sm font-medium min-h-11 transition-colors hover:bg-(--recipe-chip-bg) active:bg-(--recipe-surface-raised)"
      }
    >
      Install
    </button>
  );
}

function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="flex items-center justify-center rounded-lg border border-(--recipe-border) text-(--recipe-muted) px-2.5 py-2 min-h-11 transition-colors hover:bg-(--recipe-chip-bg) hover:text-(--recipe-text) active:bg-(--recipe-surface-raised)"
    >
      {theme === "dark" ? <SunIcon className="size-5" /> : <MoonIcon className="size-5" />}
    </button>
  );
}

export function AppLayout() {
  const { location } = useRouterState();
  const currentPath = location.pathname;

  return (
    <div className="min-h-dvh flex flex-col bg-(--recipe-bg) text-(--recipe-text)">
      {/* Top app bar — visible on mobile, hidden on md+ to feel less mobile-y */}
      <header className="md:hidden sticky top-0 z-30 bg-(--recipe-surface) border-b border-(--recipe-border) safe-top">
        <div className="flex items-center justify-between px-4 h-14 max-w-3xl mx-auto gap-2">
          <Link to="/" className="text-lg font-bold text-(--recipe-primary) leading-none">
            Family Recipes
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggleButton />
            <InstallButton />
          </div>
        </div>
      </header>

      {/* Desktop top bar */}
      <header className="hidden md:block sticky top-0 z-30 bg-(--recipe-surface) border-b border-(--recipe-border)">
        <div className="flex items-center justify-between px-6 h-16 max-w-3xl mx-auto">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-xl font-bold text-(--recipe-primary)">
              Family Recipes
            </Link>
            <nav className="flex gap-1">
              <Link
                to="/"
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive(currentPath, "/") && !isActive(currentPath, "/import")
                    ? "bg-(--recipe-chip-bg) text-(--recipe-chip-text)"
                    : "text-(--recipe-muted) hover:text-(--recipe-text)"
                }`}
              >
                Recipes
              </Link>
              <Link
                to="/import"
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive(currentPath, "/import")
                    ? "bg-(--recipe-chip-bg) text-(--recipe-chip-text)"
                    : "text-(--recipe-muted) hover:text-(--recipe-text)"
                }`}
              >
                Import
              </Link>
              <Link
                to="/meal-plans"
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive(currentPath, "/meal-plans")
                    ? "bg-(--recipe-chip-bg) text-(--recipe-chip-text)"
                    : "text-(--recipe-muted) hover:text-(--recipe-text)"
                }`}
              >
                Planner
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggleButton />
            <InstallButton />
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 pb-24 md:pb-8 pt-4">
        <Outlet />
      </main>

      {/* Bottom nav — mobile only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-(--recipe-surface) border-t border-(--recipe-border) safe-bottom">
        <div className="flex items-stretch h-16">
          <Link
            to="/"
            className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors min-h-11 ${
              isActive(currentPath, "/") && !isActive(currentPath, "/import")
                ? "text-(--recipe-primary)"
                : "text-(--recipe-muted)"
            }`}
          >
            <BookOpenIcon className="size-6" />
            Recipes
          </Link>
          <Link
            to="/import"
            className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors min-h-11 ${
              isActive(currentPath, "/import") ? "text-(--recipe-primary)" : "text-(--recipe-muted)"
            }`}
          >
            <DownloadIcon className="size-6" />
            Import
          </Link>
          <Link
            to="/meal-plans"
            className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors min-h-11 ${
              isActive(currentPath, "/meal-plans")
                ? "text-(--recipe-primary)"
                : "text-(--recipe-muted)"
            }`}
          >
            <CalendarIcon className="size-6" />
            Planner
          </Link>
        </div>
      </nav>
    </div>
  );
}
