type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function isDebugEnabled(): boolean {
  try {
    return (
      import.meta.env.DEV ||
      (typeof localStorage !== "undefined" && localStorage.getItem("debug") === "1")
    );
  } catch {
    return import.meta.env.DEV;
  }
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function forwardToApi(level: "warn" | "error", scope: string, args: unknown[]): void {
  // Skip in dev, SSR, or when fetch is unavailable.
  if (import.meta.env.DEV) return;
  if (typeof window === "undefined") return;

  try {
    let message: string;
    let fields: Record<string, unknown> | undefined;

    if (typeof args[0] === "string") {
      message = String(args[0]);
      const rest = args.slice(1);
      if (rest.length > 0) {
        fields = Object.fromEntries(rest.map((v, i) => [String(i), v]));
      }
    } else {
      message = level;
      if (args.length > 0) {
        fields = Object.fromEntries(args.map((v, i) => [String(i), v]));
      }
    }

    const body: Record<string, unknown> = { level, message, scope };
    if (fields !== undefined) body.fields = fields;

    fetch(`${API_BASE}/api/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Swallow all errors — never call the logger here to avoid infinite loops.
  }
}

function makeLogger(prefix: string) {
  const activeLevel: Level = isDebugEnabled() ? "debug" : "info";
  return {
    debug(...args: unknown[]) {
      if (LEVELS.debug >= LEVELS[activeLevel]) console.debug(`[${prefix}]`, ...args);
    },
    info(...args: unknown[]) {
      if (LEVELS.info >= LEVELS[activeLevel]) console.info(`[${prefix}]`, ...args);
    },
    warn(...args: unknown[]) {
      console.warn(`[${prefix}]`, ...args);
      forwardToApi("warn", prefix, args);
    },
    error(...args: unknown[]) {
      console.error(`[${prefix}]`, ...args);
      forwardToApi("error", prefix, args);
    },
    child(scope: string) {
      return makeLogger(`${prefix}:${scope}`);
    },
  };
}

export const logger = makeLogger("web");
