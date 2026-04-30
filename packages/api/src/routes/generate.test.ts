import { afterEach, describe, expect, mock, test } from "bun:test";
import { createApp } from "../app";

// ---------------------------------------------------------------------------
// Mock the Anthropic SDK so no real API calls are made
// ---------------------------------------------------------------------------

const mockCreate = mock(async () => ({}));

mock.module("@anthropic-ai/sdk", () => {
  class RateLimitError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "RateLimitError";
    }
  }

  class Anthropic {
    messages = { create: mockCreate };
    static RateLimitError = RateLimitError;
  }

  return { default: Anthropic };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const app = createApp();

function post(body: unknown) {
  return app.fetch(
    new Request("http://localhost/api/recipes/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const validRecipeJson = JSON.stringify({
  title: "Test Pasta",
  description: "A tasty pasta dish",
  baseServings: 4,
  prepTimeMinutes: 10,
  cookTimeMinutes: 20,
  instructions: ["Boil water", "Cook pasta", "Add sauce"],
  ingredients: [
    { item: "pasta", quantity: 200, unit: "g", originalLine: "200g pasta" },
    { item: "tomato sauce", quantity: 1, unit: "cup", originalLine: "1 cup tomato sauce" },
  ],
  favourite: false,
  tagIds: [],
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/recipes/generate", () => {
  const savedKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    // Restore API key state after each test
    process.env.ANTHROPIC_API_KEY = savedKey;
    mockCreate.mockReset();
  });

  test("returns 503 when ANTHROPIC_API_KEY is not set", async () => {
    process.env.ANTHROPIC_API_KEY = undefined;
    const res = await post({ prompt: "Make me some pasta" });
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("GENERATION_UNAVAILABLE");
  });

  test("returns 400 when request body is invalid (empty prompt)", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const res = await post({ prompt: "" });
    expect(res.status).toBe(400);
  });

  test("returns 400 when prompt is missing", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const res = await post({});
    expect(res.status).toBe(400);
  });

  test("returns 200 with recipe when Claude returns valid JSON", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: validRecipeJson }],
    });

    const res = await post({ prompt: "Make me some pasta" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { recipe: { title: string } };
    expect(body.recipe.title).toBe("Test Pasta");
    expect(body.recipe).toHaveProperty("ingredients");
    expect(body.recipe).toHaveProperty("instructions");
  });

  test("passes servings and dietary to Claude when provided", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: validRecipeJson }],
    });

    await post({ prompt: "Make me some pasta", servings: 6, dietary: "gluten-free" });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = (
      mockCreate.mock.calls[0] as unknown as [{ messages: Array<{ content: string }> }]
    )[0];
    const userContent = callArgs?.messages[0]?.content ?? "";
    expect(userContent).toContain("Servings: 6");
    expect(userContent).toContain("gluten-free");
  });

  test("returns 422 when Claude returns non-JSON output", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "Here is your recipe: blah blah blah" }],
    });

    const res = await post({ prompt: "Make me some pasta" });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("GENERATION_FAILED");
  });

  test("returns 422 when Claude returns JSON that fails schema validation", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    // Missing required 'title' field
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: '{"baseServings": 4, "instructions": []}' }],
    });

    const res = await post({ prompt: "Make me some pasta" });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("GENERATION_FAILED");
  });

  test("returns 422 when Claude returns unexpected content block type", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    mockCreate.mockResolvedValue({
      content: [{ type: "tool_use", id: "x", name: "y", input: {} }],
    });

    const res = await post({ prompt: "Make me some pasta" });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("GENERATION_FAILED");
  });
});
