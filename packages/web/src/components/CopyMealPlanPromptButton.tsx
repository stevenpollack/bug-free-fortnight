import { useCallback, useState } from "react";
import { useMealPlanSchema, useRecipesList } from "../api/queries";
import { buildMealPlanPrompt } from "../lib/mealPlanPrompt";
import { CheckIcon, ClipboardIcon } from "./icons";

export function CopyMealPlanPromptButton() {
  const { data: schema } = useMealPlanSchema();
  const { data: recipes } = useRecipesList();
  const [copied, setCopied] = useState(false);

  const isReady = !!schema;

  const handleCopy = useCallback(async () => {
    if (!schema) return;

    const library = (recipes ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      tags: r.tagIds,
    }));

    const prompt = buildMealPlanPrompt(schema, library);

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(prompt);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = prompt;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [schema, recipes]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={!isReady}
      className="w-full flex items-center justify-center gap-2 rounded-xl border border-(--recipe-border) bg-(--recipe-surface-raised) px-4 py-3 text-sm font-medium text-(--recipe-text) hover:bg-(--recipe-surface) disabled:opacity-50 transition-colors min-h-11"
    >
      {copied ? (
        <>
          <CheckIcon className="size-4 text-(--recipe-primary)" />
          Copied!
        </>
      ) : (
        <>
          <ClipboardIcon className="size-4" />
          Copy prompt for ChatGPT / Claude
        </>
      )}
    </button>
  );
}
