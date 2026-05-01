import type { AppType } from "@api/app";
import { hc } from "hono/client";
import { getAnthropicKey } from "../lib/anthropicKey";
import { logger } from "../lib/logger";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

// ---------------------------------------------------------------------------
// Typed hono client
// ---------------------------------------------------------------------------

export const client = hc<AppType>(API_BASE, {
  headers: () => {
    const key = getAnthropicKey();
    const headers: Record<string, string> = {};
    if (key) headers["X-Anthropic-Key"] = key;
    return headers;
  },
});

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Response unwrapper — converts a raw hc Response into typed data or throws
// ---------------------------------------------------------------------------

export async function unwrap<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;

  const json = (await res.json()) as unknown;

  if (!res.ok) {
    const body = json as { error?: { code?: string; message?: string } };
    const code = body?.error?.code ?? "UNKNOWN";
    const message = body?.error?.message ?? res.statusText;
    const err = new ApiError(res.status, code, message);
    logger.warn({ status: res.status, code, message }, "api error");
    throw err;
  }

  return json as T;
}
