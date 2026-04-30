# Recipe Generation Prompt Template

Use this prompt with any LLM (Claude, ChatGPT, etc.) to generate recipes in the correct JSON format for import into the app.

## How to use

1. Copy the prompt below
2. Paste it into your LLM of choice
3. Add your specific request after it (e.g. "Make me a quick weeknight chicken stir-fry for 4 people")
4. Copy the JSON response
5. Paste it into the app's "Paste JSON" tab on the New Recipe page

## Programmatic access

The live JSON Schema is always available at:

```
GET /api/schemas/recipe
```

This returns a JSON Schema (draft 2020-12) that stays in sync with the app's validation rules.

## Prompt

```
Generate a recipe and return it as a single JSON object matching this JSON Schema:

{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "title": { "type": "string", "minLength": 1 },
    "description": { "anyOf": [{ "type": "string" }, { "type": "null" }] },
    "sourceUrl": { "anyOf": [{ "type": "string", "format": "uri" }, { "type": "null" }] },
    "imageUrl": { "anyOf": [{ "type": "string", "format": "uri" }, { "type": "null" }] },
    "baseServings": { "type": "integer", "minimum": 1, "default": 1 },
    "prepTimeMinutes": { "anyOf": [{ "type": "integer", "minimum": 0 }, { "type": "null" }] },
    "cookTimeMinutes": { "anyOf": [{ "type": "integer", "minimum": 0 }, { "type": "null" }] },
    "notes": { "anyOf": [{ "type": "string" }, { "type": "null" }] },
    "instructions": { "type": "array", "items": { "type": "string" }, "default": [] },
    "favourite": { "type": "boolean", "default": false },
    "ingredients": {
      "type": "array",
      "default": [],
      "items": {
        "type": "object",
        "properties": {
          "item": { "type": "string", "minLength": 1 },
          "quantity": { "anyOf": [{ "type": "number", "exclusiveMinimum": 0 }, { "type": "null" }] },
          "unit": { "anyOf": [{ "type": "string" }, { "type": "null" }] },
          "notes": { "anyOf": [{ "type": "string" }, { "type": "null" }] },
          "originalLine": { "type": "string" },
          "groupHeading": { "anyOf": [{ "type": "string" }, { "type": "null" }] },
          "displayOrder": { "type": "integer", "minimum": 0 }
        },
        "required": ["item"],
        "additionalProperties": false
      }
    },
    "tagIds": { "type": "array", "items": { "type": "string" }, "default": [] }
  },
  "required": ["title", "baseServings", "instructions", "favourite", "ingredients", "tagIds"],
  "additionalProperties": false
}

Guidelines:
- "title": A descriptive recipe name
- "description": 1-2 sentence summary (or null)
- "baseServings": How many servings this recipe makes (integer >= 1)
- "prepTimeMinutes" / "cookTimeMinutes": Estimated times in minutes (or null if unknown)
- "ingredients": Array of ingredient objects. For each:
  - "item": The ingredient name (e.g. "all-purpose flour")
  - "quantity": Numeric amount (e.g. 2.5) or null
  - "unit": Measurement unit (e.g. "cups", "tbsp") or null
  - "notes": Prep notes like "finely diced" or null
  - "originalLine": The full ingredient as you'd write it (e.g. "2 1/2 cups all-purpose flour, sifted")
- "instructions": Array of strings, one step per element. Be concise but complete.
- "notes": Any additional tips (or null)
- "favourite": Always set to false
- "tagIds": Always set to [] (empty array)

Return ONLY the JSON object - no markdown fences, no explanation.
```
