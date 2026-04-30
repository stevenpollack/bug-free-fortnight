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
    },
    error(...args: unknown[]) {
      console.error(`[${prefix}]`, ...args);
    },
    child(scope: string) {
      return makeLogger(`${prefix}:${scope}`);
    },
  };
}

export const logger = makeLogger("web");
