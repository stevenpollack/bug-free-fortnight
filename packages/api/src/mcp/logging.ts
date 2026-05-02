import { childLogger } from "../logger";

export const mcpLogger = childLogger({ service: "mcp" });

export async function withToolLog<T>(tool: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  mcpLogger.info({ tool }, "tool call");
  try {
    const result = await fn();
    mcpLogger.info({ tool, durationMs: Date.now() - start }, "tool ok");
    return result;
  } catch (err) {
    mcpLogger.error({ tool, durationMs: Date.now() - start, err }, "tool error");
    throw err;
  }
}

export async function withResourceLog<T>(uri: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  mcpLogger.debug({ uri }, "resource read");
  try {
    const result = await fn();
    mcpLogger.debug({ uri, durationMs: Date.now() - start }, "resource ok");
    return result;
  } catch (err) {
    mcpLogger.error({ uri, durationMs: Date.now() - start, err }, "resource error");
    throw err;
  }
}
