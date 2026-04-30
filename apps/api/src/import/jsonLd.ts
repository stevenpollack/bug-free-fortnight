// Lightweight regex-based JSON-LD extractor.
// We use regex here (rather than a full HTML parser) because the input is a
// known site (RecipeTin Eats) and the <script type="application/ld+json"> blocks
// are reliably self-contained. If parsing fails, we skip cleanly.
const SCRIPT_RE = /<script\s[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

type JsonLdObject = Record<string, unknown>;

function isRecipe(obj: unknown): obj is JsonLdObject {
  if (typeof obj !== "object" || obj === null) return false;
  const type = (obj as JsonLdObject)["@type"];
  if (typeof type === "string") return type === "Recipe";
  if (Array.isArray(type)) return type.includes("Recipe");
  return false;
}

function findRecipeInValue(value: unknown): JsonLdObject | null {
  if (isRecipe(value)) return value as JsonLdObject;

  if (typeof value === "object" && value !== null) {
    const obj = value as JsonLdObject;

    // Handle @graph arrays
    if (Array.isArray(obj["@graph"])) {
      for (const item of obj["@graph"] as unknown[]) {
        if (isRecipe(item)) return item as JsonLdObject;
      }
    }
  }

  // Handle top-level arrays of JSON-LD objects
  if (Array.isArray(value)) {
    for (const item of value as unknown[]) {
      const found = findRecipeInValue(item);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Extract the first Schema.org Recipe JSON-LD object from an HTML string.
 * Returns `null` if none is found.
 */
export function extractRecipeJsonLd(html: string): JsonLdObject | null {
  SCRIPT_RE.lastIndex = 0;

  for (;;) {
    const match = SCRIPT_RE.exec(html);
    if (!match) break;

    const raw = match[1].trim();
    try {
      const parsed: unknown = JSON.parse(raw);
      const recipe = findRecipeInValue(parsed);
      if (recipe) return recipe;
    } catch {
      // Malformed JSON — skip this block
    }
  }

  return null;
}
