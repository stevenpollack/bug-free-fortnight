# Copy-Prompt Button Refactor — Implementation Plan

## Context

The "Copy AI prompt" button currently lives next to the H1 on `RecipeCreate`. That placement is wrong for the actual user journey: the escape-hatch flow is `click copy → leave app → use external LLM → copy output → return → paste`, but RecipeCreate is reached only after the user has already committed to manual entry. The copy action and the paste target are also visually disconnected.

This plan moves the copy action into the `GenerateRecipeSheet` directly above the paste textarea, ties the round-trip together with progressive feedback, and extracts the clipboard fallback so meal-plan generation can reuse it.

---

## Goals

- Make the copy + paste round-trip feel like a single coherent flow.
- Keep the in-app Generate path (path a) unchanged when an API key is available.
- Extract the `execCommand` clipboard fallback for reuse by future features.
- No new top-level pages, tabs, or clipboard-sniffing toasts.

---

## UX Direction (from UI designer consult)

### Inside `GenerateRecipeSheet`, "Paste JSON" tab

1. **Above the paste textarea**: full-width secondary button labeled "Copy prompt for ChatGPT / Claude" with the clipboard icon.
2. Below the button, muted helper text: "Paste the response into the box below when you're done."
3. After copy:
   - Button label flips to "Copied — go get your JSON" for ~2s (existing pattern).
   - Sheet stays open. Do **not** auto-close.
   - The paste textarea gains a pulsing border (`animate-pulse` on `border-(--recipe-primary)`) so the target is visually calling on return.
4. Clear the pulse once the textarea has any content.

### Re-entry hint

On `RecipesIndex`, beneath the existing "Generate recipe" trigger, add a small text link "Paste JSON from external AI" that opens the sheet directly to the Paste tab. Invisible to first-time users, helpful to returning ones.

### RecipeCreate header

Remove `CopyRecipePromptButton` from the page header entirely. The sheet is now the single canonical entry point for the escape hatch.

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `packages/web/src/lib/copyToClipboard.ts` | Create — shared helper with `navigator.clipboard.writeText` + `execCommand` fallback |
| `packages/web/src/components/CopyRecipePromptButton.tsx` | Modify — delegate to `copyToClipboard` helper; keep as a thin wrapper, drop inline fallback |
| `packages/web/src/components/GenerateRecipeSheet.tsx` | Modify — render copy button + helper text above paste textarea; pulse textarea after copy |
| `packages/web/src/pages/RecipeCreate.tsx` | Modify — remove `CopyRecipePromptButton` from H1 area |
| `packages/web/src/pages/RecipesIndex.tsx` | Modify — add "Paste JSON from external AI" secondary link beneath Generate trigger |
| `packages/web/src/__tests__/GenerateRecipeSheet.test.tsx` | Modify or create — assert copy button renders inside Paste tab and triggers clipboard write |

---

## Implementation Notes

- `copyToClipboard.ts` API: `export async function copyToClipboard(text: string): Promise<void>`. Throws on both branches failing so callers can show error UI; the existing button consumes the promise and renders the "Copied" state on success.
- The pulse can be a single boolean state in the sheet (`pulsingPaste`) toggled true on copy, false on textarea change or unmount.
- Helper text uses `var(--recipe-muted)` (or whichever existing muted token is canonical — check `Header.tsx` for precedent).
- Tap targets ≥44px for the copy button; full-width on mobile, comfortable on tablet.

---

## Commit Sequence

1. `refactor(web): extract copyToClipboard helper`
2. `feat(web): copy-prompt button inside GenerateRecipeSheet paste tab`
3. `feat(web): add "Paste JSON from external AI" re-entry link on RecipesIndex`
4. `chore(web): remove copy-prompt button from RecipeCreate header`

---

## Verification

1. `bun run check` — typecheck, lint, unit tests, build all pass.
2. Manual:
   - Open Generate sheet with no API key → land on Paste tab → copy button visible above textarea.
   - Click copy → label changes → textarea pulses.
   - Type into textarea → pulse stops.
   - Close sheet, return via "Paste JSON from external AI" link → sheet reopens on Paste tab.
   - With API key set → Generate tab is default, copy button is in the Paste tab if user switches but isn't pushed at them.
