import Anthropic from "@anthropic-ai/sdk";
import { Hono } from "hono";
import type { HonoEnv } from "../types";

export const anthropicKeyRouter = new Hono<HonoEnv>();

// ---------------------------------------------------------------------------
// POST /anthropic/test-key
// ---------------------------------------------------------------------------
// Validates the key supplied in X-Anthropic-Key by making a minimal call
// (max_tokens: 1) to the Anthropic Messages API.  Returns { ok: true } or
// a structured error with the upstream message.

anthropicKeyRouter.post("/anthropic/test-key", async (c) => {
  const apiKey = c.req.header("x-anthropic-key");

  if (!apiKey) {
    return c.json(
      { error: { code: "MISSING_KEY", message: "X-Anthropic-Key header is required" } },
      400,
    );
  }

  const anthropic = new Anthropic({ apiKey });

  try {
    await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1,
      messages: [{ role: "user", content: "Hi" }],
    });
    return c.json({ ok: true });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return c.json(
        { error: { code: "INVALID_KEY", message: "API key is invalid or has been revoked" } },
        401,
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      return c.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Rate limit reached — key is valid but try again shortly",
          },
        },
        429,
      );
    }
    const message = err instanceof Error ? err.message : "Unexpected error from Anthropic";
    return c.json({ error: { code: "TEST_FAILED", message } }, 502);
  }
});
