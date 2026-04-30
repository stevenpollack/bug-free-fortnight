export interface LibraryRecipe {
  id: string;
  title: string;
  tags: string[];
}

export function buildMealPlanPrompt(
  schema: Record<string, unknown>,
  libraryRecipes: LibraryRecipe[],
): string {
  const schemaStr = JSON.stringify(schema, null, 2);
  const libraryStr = JSON.stringify(libraryRecipes, null, 2);

  return `You are a meal planner for a household. Fill a weekly meal plan with dinners based on the user's request.

IMPORTANT: Prefer reusing existing recipes from the library below by referencing their id. Only invent new inline recipes when nothing in the library fits the request.

Return ONLY a valid JSON object — no markdown, no explanation, no code fences. The JSON must exactly match this JSON Schema:

\`\`\`json
${schemaStr}
\`\`\`

For each slot:
- If using an existing recipe: set type="existing" and provide the recipeId from the library.
- If inventing a new recipe: set type="new" and provide a full recipe object. Set tagIds=[] and favourite=false.

Only fill the days the user asks for. Leave other days absent (do not include them in the slots array).

User's recipe library:
\`\`\`json
${libraryStr}
\`\`\`

Return raw JSON only — no markdown fences, no explanation.`;
}
