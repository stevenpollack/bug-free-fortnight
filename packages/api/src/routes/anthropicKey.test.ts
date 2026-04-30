import { afterEach, describe, expect, mock, test } from "bun:test";
import { createApp } from "../app";

// ---------------------------------------------------------------------------
// Mock error classes (mirror the real SDK shape the route checks against)
// ---------------------------------------------------------------------------

class MockAuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

class MockRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

// ---------------------------------------------------------------------------
// Mock the Anthropic SDK so no real API calls are made
// ---------------------------------------------------------------------------

const mockCreate = mock(async () => ({}));

mock.module("@anthropic-ai/sdk", () => {
  class Anthropic {
    messages = { create: mockCreate };
    static AuthenticationError = MockAuthenticationError;
    static RateLimitError = MockRateLimitError;
  }

  return { default: Anthropic };
});

const app = createApp();

function post(headers?: Record<string, string>) {
  return app.fetch(
    new Request("http://localhost/api/anthropic/test-key", {
      method: "POST",
      headers: { ...headers },
    }),
  );
}

describe("POST /api/anthropic/test-key", () => {
  afterEach(() => {
    mockCreate.mockReset();
  });

  test("returns 400 when X-Anthropic-Key header is missing", async () => {
    const res = await post();
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("MISSING_KEY");
  });

  test("returns { ok: true } when key is valid", async () => {
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: "Hi" }] });
    const res = await post({ "x-anthropic-key": "valid-key" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  test("returns 401 when key is invalid (AuthenticationError)", async () => {
    mockCreate.mockRejectedValue(new MockAuthenticationError("invalid key"));
    const res = await post({ "x-anthropic-key": "bad-key" });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_KEY");
  });

  test("returns 429 when rate limited", async () => {
    mockCreate.mockRejectedValue(new MockRateLimitError("rate limit"));
    const res = await post({ "x-anthropic-key": "valid-key" });
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("RATE_LIMITED");
  });
});
