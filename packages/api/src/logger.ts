import pino from "pino";

// Silent during `bun test` (Bun sets BUN_TEST=1) and when NODE_ENV=test.
const isTest = process.env.NODE_ENV === "test" || process.env.BUN_TEST === "1";

const isPretty =
  !isTest &&
  (process.env.NODE_ENV !== "production" || process.env.LOG_PRETTY === "1");

export const logger = pino({
  level: isTest ? "silent" : (process.env.LOG_LEVEL ?? "info"),
  ...(isPretty
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" },
        },
      }
    : {}),
});

export function childLogger(bindings: Record<string, unknown>): pino.Logger {
  return logger.child(bindings);
}
