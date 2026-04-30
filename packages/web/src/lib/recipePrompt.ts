export function buildRecipePrompt(jsonSchema: Record<string, unknown>): string {
  const schemaStr = JSON.stringify(jsonSchema, null, 2);

  return `Generate a recipe and return it as a single JSON object matching this JSON Schema:

\`\`\`json
${schemaStr}
\`\`\`

Guidelines:
- "title": A descriptive recipe name
- "description": 1–2 sentence summary (or null)
- "baseServings": How many servings this recipe makes (integer ≥ 1)
- "prepTimeMinutes" / "cookTimeMinutes": Estimated times in minutes (or null if unknown)
- "ingredients": Array of ingredient objects. For each:
  - "item": The ingredient name (e.g. "all-purpose flour")
  - "quantity": Numeric amount (e.g. 2.5) or null
  - "unit": Measurement unit (e.g. "cups", "tbsp") or null
  - "notes": Prep notes like "finely diced" or null
  - "originalLine": The full ingredient as you'd write it (e.g. "2½ cups all-purpose flour, sifted")
- "instructions": Array of strings, one step per element. Be concise but complete.
- "notes": Any additional tips (or null)
- "favourite": Always set to false
- "tagIds": Always set to [] (empty array)

Return ONLY the JSON object — no markdown fences, no explanation.`;
}
