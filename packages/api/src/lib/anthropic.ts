import Anthropic from "@anthropic-ai/sdk";
import type { MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages";
import type { ZodSchema } from "zod";
import { HttpError } from "../errors";

export async function callAnthropic(
  apiKey: string,
  params: MessageCreateParamsNonStreaming,
): Promise<string> {
  const client = new Anthropic({ apiKey });
  let response: Awaited<ReturnType<typeof client.messages.create>>;
  try {
    response = await client.messages.create(params);
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      throw new HttpError(429, "RATE_LIMITED", "Too many requests — please try again shortly");
    }
    throw err;
  }

  const block = response.content[0];
  if (block?.type !== "text") {
    throw new HttpError(422, "GENERATION_FAILED", "Claude returned an unexpected response type");
  }
  return block.text;
}

export function parseAndValidate<T>(rawText: string, schema: ZodSchema<T>): T {
  // Strip optional markdown code fences
  const stripped = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new HttpError(422, "GENERATION_FAILED", "Claude returned non-JSON output");
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new HttpError(
      422,
      "GENERATION_FAILED",
      `Generated content did not match expected schema: ${result.error.issues[0]?.message ?? "unknown error"}`,
    );
  }
  return result.data;
}
