import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { callAnthropic, parseAndValidate } from "../lib/anthropic";
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

  const rawText = await callAnthropic(apiKey, {
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const recipe = parseAndValidate(rawText, RecipeCreate);
  return c.json({ recipe });
});
