// Lightweight regex-based JSON-LD extractor.
// We use regex here (rather than a full HTML parser) because the input is a
// known site (RecipeTin Eats) and the <script type="application/ld+json"> blocks
// are reliably self-contained. If parsing fails, we skip cleanly.
import type pino from "pino";
import { logger as rootLogger } from "../logger";

const SCRIPT_RE = /<script\s[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

type JsonLdObject = Record<string, unknown>;

function isRecipe(obj: unknown): obj is JsonLdObject {
  if (typeof obj !== "object" || obj === null) return false;
  const type = (obj as JsonLdObject)["@type"];
  if (typeof type === "string") return type === "Recipe";
  if (Array.isArray(type)) return type.includes("Recipe");
  return false;
}

function findRecipeInValue(
  value: unknown,
): { recipe: JsonLdObject | null; found: "top" | "graph" | "none" } {
  if (isRecipe(value)) return { recipe: value as JsonLdObject, found: "top" };

  if (typeof value === "object" && value !== null) {
    const obj = value as JsonLdObject;

    // Handle @graph arrays
    if (Array.isArray(obj["@graph"])) {
      for (const item of obj["@graph"] as unknown[]) {
        if (isRecipe(item)) return { recipe: item as JsonLdObject, found: "graph" };
      }
    }
  }

  // Handle top-level arrays of JSON-LD objects
  if (Array.isArray(value)) {
    for (const item of value as unknown[]) {
      const result = findRecipeInValue(item);
      if (result.recipe) return result;
    }
  }

  return { recipe: null, found: "none" };
}

/**
 * Extract the first Schema.org Recipe JSON-LD object from an HTML string.
 * Returns `null` if none is found.
 */
export function extractRecipeJsonLd(
  html: string,
  log: pino.Logger = rootLogger,
): JsonLdObject | null {
  SCRIPT_RE.lastIndex = 0;

  let candidateBlocks = 0;
  let foundType: "top" | "graph" | "none" = "none";

  for (;;) {
    const match = SCRIPT_RE.exec(html);
    if (!match) break;

    candidateBlocks++;
    const raw = match[1].trim();
    try {
      const parsed: unknown = JSON.parse(raw);
      const { recipe, found } = findRecipeInValue(parsed);
      if (recipe) {
        foundType = found;
        log.debug({ candidateBlocks, found: foundType }, "json-ld scan");
        return recipe;
      }
    } catch {
      // Malformed JSON — skip this block
    }
  }

  log.debug({ candidateBlocks, found: foundType }, "json-ld scan");
  return null;
}
