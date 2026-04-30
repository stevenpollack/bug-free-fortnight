import Anthropic from "@anthropic-ai/sdk";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { RecipeCreate, RecipeGenerateBody } from "../schemas/index";
import type { HonoEnv } from "../types";

export const generateRouter = new Hono<HonoEnv>();

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a recipe generator. When the user describes a recipe they want, return ONLY a valid JSON object — no markdown, no explanation, no code fences. The JSON must match this exact shape:

{
  "title": "string (required)",
  "description": "string or null",
  "baseServings": "integer >= 1 (required)",
  "prepTimeMinutes": "integer >= 0 or null",
  "cookTimeMinutes": "integer >= 0 or null",
  "instructions": ["array of step strings"],
  "ingredients": [
    {
      "item": "string (required)",
      "quantity": "positive number or null",
      "unit": "string or null",
      "originalLine": "string (required, the ingredient as written)"
    }
  ]
}

Do not include any fields outside this shape. Return raw JSON only.`;

// ---------------------------------------------------------------------------
// POST /recipes/generate
// ---------------------------------------------------------------------------

generateRouter.post("/recipes/generate", zValidator("json", RecipeGenerateBody), async (c) => {
  const apiKey = c.req.header("x-anthropic-key") ?? process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return c.json(
      {
        error: {
          code: "GENERATION_UNAVAILABLE",
          message: "Recipe generation is not configured",
        },
      },
      503,
    );
  }

  const body = c.req.valid("json");

  // Build user prompt
  const parts: string[] = [`Generate a recipe for: ${body.prompt}`];
  if (body.servings) parts.push(`Servings: ${body.servings}`);
  if (body.dietary) parts.push(`Dietary requirements: ${body.dietary}`);
  const userMessage = parts.join("\n");

  const anthropic = new Anthropic({ apiKey });

  let rawText: string;
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const block = response.content[0];
    if (block?.type !== "text") {
      return c.json(
        {
          error: {
            code: "GENERATION_FAILED",
            message: "Claude returned an unexpected response type",
          },
        },
        422,
      );
    }
    rawText = block.text;
  } catch (err) {
    // Check for rate limit error from Anthropic SDK
    if (err instanceof Anthropic.RateLimitError) {
      return c.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests — please try again shortly",
          },
        },
        429,
      );
    }
    throw err;
  }

  // Parse JSON from Claude's response
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return c.json(
      {
        error: {
          code: "GENERATION_FAILED",
          message: "Claude returned non-JSON output",
        },
      },
      422,
    );
  }

  // Validate against RecipeCreate schema
  const result = RecipeCreate.safeParse(parsed);
  if (!result.success) {
    return c.json(
      {
        error: {
          code: "GENERATION_FAILED",
          message: `Generated recipe did not match expected schema: ${result.error.issues[0]?.message ?? "unknown error"}`,
        },
      },
      422,
    );
  }

  return c.json({ recipe: result.data });
});
