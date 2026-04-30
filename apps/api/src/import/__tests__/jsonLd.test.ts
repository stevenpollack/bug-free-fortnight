import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractRecipeJsonLd } from "../jsonLd";

const fixtureDir = join(import.meta.dir, "fixtures");

function loadFixture(name: string): string {
  return readFileSync(join(fixtureDir, name), "utf8");
}

describe("extractRecipeJsonLd", () => {
  test("extracts Recipe from a single JSON-LD block", () => {
    const html = loadFixture("french-toast.html");
    const result = extractRecipeJsonLd(html);
    expect(result).not.toBeNull();
    expect(result?.["@type"]).toBe("Recipe");
    expect(result?.name).toBe("French Toast");
  });

  test("extracts Recipe from an @graph array", () => {
    const html = loadFixture("graph.html");
    const result = extractRecipeJsonLd(html);
    expect(result).not.toBeNull();
    expect(result?.["@type"]).toBe("Recipe");
    expect(result?.name).toBe("Graph French Toast");
  });

  test("returns null when no Recipe is present", () => {
    const html = `
      <html>
      <head>
        <script type="application/ld+json">
          { "@type": "WebPage", "name": "Home" }
        </script>
      </head>
      </html>`;
    expect(extractRecipeJsonLd(html)).toBeNull();
  });

  test("returns null for malformed JSON block", () => {
    const html = `<script type="application/ld+json">{ broken json }</script>`;
    expect(extractRecipeJsonLd(html)).toBeNull();
  });

  test("returns null for page with no JSON-LD at all", () => {
    expect(extractRecipeJsonLd("<html><body>No structured data</body></html>")).toBeNull();
  });

  test("handles @type as an array", () => {
    const html = `
      <script type="application/ld+json">
        { "@type": ["Recipe", "Thing"], "name": "Array type recipe" }
      </script>`;
    const result = extractRecipeJsonLd(html);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Array type recipe");
  });
});
