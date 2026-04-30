import type pino from "pino";
import { logger as rootLogger } from "../logger";
import type { RecipeCreate } from "../schemas/index";
import { extractRecipeJsonLd } from "./jsonLd";
import { parseIngredientLine } from "./parse";
import { type Fetcher, safeFetch } from "./safeFetch";

export interface ImportResult {
  recipe: RecipeCreate;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip HTML tags from a string (handles simple markup from schema.org fields). */
function stripHtml(str: string): string {
  return str.replace(/<[^>]+>/g, "").trim();
}

/** Parse ISO 8601 duration to total minutes. Handles PT1H30M, PT45M, P0D, etc. */
function parseIsoDuration(duration: unknown): number | null {
  if (typeof duration !== "string" || !duration) return null;
  const match = duration.match(/^P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?(?:\d+S)?$/i);
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const total = hours * 60 + minutes;
  return total > 0 ? total : null;
}

/** Parse recipeYield to a positive integer. Handles "8", "8 servings", "8-10 servings". */
function parseYield(value: unknown, warnings: string[]): number {
  if (value == null) return 1;
  const candidates = Array.isArray(value) ? value : [value];
  for (const candidate of candidates) {
    const str = String(candidate).trim();
    const match = str.match(/(\d+)/);
    if (match) {
      const n = Number(match[1]);
      if (n > 0) {
        if (/\d+-\d+/.test(str)) {
          warnings.push(`Unrecognised yield format "${str}"; using first number ${n}`);
        }
        return n;
      }
    }
  }
  warnings.push(`Could not parse recipeYield "${JSON.stringify(value)}"; defaulting to 1`);
  return 1;
}

/** Flatten recipeInstructions (string[], HowToStep[], or HowToSection[]) to string[]. */
function flattenInstructions(raw: unknown, warnings: string[]): string[] {
  if (!raw) return [];
  if (typeof raw === "string") return raw.split(/\n+/).filter(Boolean);

  if (!Array.isArray(raw)) {
    warnings.push("recipeInstructions had unexpected format; ignoring");
    return [];
  }

  const steps: string[] = [];
  for (const item of raw as unknown[]) {
    if (typeof item === "string") {
      steps.push(stripHtml(item));
    } else if (typeof item === "object" && item !== null) {
      const obj = item as Record<string, unknown>;
      const type = obj["@type"];

      if (type === "HowToStep") {
        const text = obj.text ?? obj.name;
        if (typeof text === "string") {
          steps.push(stripHtml(text));
        } else {
          warnings.push("HowToStep entry had no text field; skipping");
        }
      } else if (type === "HowToSection") {
        const sectionItems = obj.itemListElement;
        if (Array.isArray(sectionItems)) {
          for (const step of sectionItems as unknown[]) {
            if (typeof step === "object" && step !== null) {
              const s = step as Record<string, unknown>;
              const text = s.text ?? s.name;
              if (typeof text === "string") steps.push(stripHtml(text));
            }
          }
        }
      } else {
        warnings.push(
          `recipeInstructions contained non-step entry (@type=${String(type)}); skipping`,
        );
      }
    }
  }
  return steps.filter(Boolean);
}

/** Extract a string image URL from the schema.org `image` field. */
function extractImageUrl(image: unknown): string | null {
  if (typeof image === "string") return image;
  if (Array.isArray(image)) {
    const first = image[0];
    if (typeof first === "string") return first;
    if (typeof first === "object" && first !== null) {
      const url = (first as Record<string, unknown>).url;
      if (typeof url === "string") return url;
    }
  }
  if (typeof image === "object" && image !== null) {
    const url = (image as Record<string, unknown>).url;
    if (typeof url === "string") return url;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Import a RecipeTin Eats recipe from a URL.
 * Returns the parsed `RecipeCreate` payload and any parser warnings.
 * Does NOT persist anything to the database.
 *
 * @param fetcher - Defaults to global `fetch`; tests inject a mock.
 */
export async function importRecipeTinEats(
  url: string,
  fetcher: Fetcher = fetch,
  log: pino.Logger = rootLogger,
): Promise<ImportResult> {
  const warnings: string[] = [];

  const response = await safeFetch(url, fetcher, log);
  if (!response.ok) {
    throw new Error(`Fetch failed with status ${response.status}`);
  }

  log.info({ url }, "importer: fetched page");

  const html = await response.text();
  const jsonLd = extractRecipeJsonLd(html, log);

  if (!jsonLd) {
    throw new Error("No Schema.org Recipe JSON-LD found on the page");
  }

  log.info({ url }, "importer: json-ld extracted");

  const title = typeof jsonLd.name === "string" ? jsonLd.name.trim() : "";
  if (!title) throw new Error("Recipe JSON-LD has no name field");

  const description = typeof jsonLd.description === "string" ? stripHtml(jsonLd.description) : null;

  const sourceUrl = url;
  const imageUrl = extractImageUrl(jsonLd.image);

  const baseServings = parseYield(jsonLd.recipeYield, warnings);
  const prepTimeMinutes = parseIsoDuration(jsonLd.prepTime);
  const cookTimeMinutes = parseIsoDuration(jsonLd.cookTime);

  const instructions = flattenInstructions(jsonLd.recipeInstructions, warnings);

  const rawIngredients = Array.isArray(jsonLd.recipeIngredient)
    ? (jsonLd.recipeIngredient as unknown[])
    : [];

  const ingredients = rawIngredients.map((raw, idx) => {
    const line = typeof raw === "string" ? raw : String(raw);
    const parsed = parseIngredientLine(line);

    if (parsed.quantity === null && parsed.unit === null && parsed.item === line) {
      warnings.push(`Ingredient line ${idx + 1} could not be parsed; using as plain item`);
    }

    return {
      displayOrder: idx,
      groupHeading: null as string | null,
      quantity: parsed.quantity,
      unit: parsed.unit,
      item: parsed.item,
      notes: parsed.notes,
      originalLine: line,
    };
  });

  const recipe: RecipeCreate = {
    title,
    description: description ?? undefined,
    sourceUrl,
    imageUrl: imageUrl ?? undefined,
    baseServings,
    prepTimeMinutes: prepTimeMinutes ?? undefined,
    cookTimeMinutes: cookTimeMinutes ?? undefined,
    notes: undefined,
    instructions,
    favourite: false,
    ingredients,
    tagIds: [],
  };

  log.info(
    {
      url,
      title,
      ingredientCount: ingredients.length,
      instructionCount: instructions.length,
      warningsCount: warnings.length,
    },
    "importer: recipe normalised",
  );

  return { recipe, warnings };
}
