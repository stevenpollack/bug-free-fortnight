import { useCallback, useState } from "react";
import { useRecipeSchema } from "../api/queries";
import { buildRecipePrompt } from "../lib/recipePrompt";
import { CheckIcon, ClipboardIcon } from "./icons";

export function CopyRecipePromptButton() {
  const { data: schema } = useRecipeSchema();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!schema) return;
    const prompt = buildRecipePrompt(schema);
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
  }, [schema]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={!schema}
      className="inline-flex items-center gap-1.5 text-sm text-(--recipe-muted) hover:text-(--recipe-text) disabled:opacity-50 transition-colors"
    >
      {copied ? (
        <>
          <CheckIcon className="size-4" />
          Copied!
        </>
      ) : (
        <>
          <ClipboardIcon className="size-4" />
          Copy AI prompt
        </>
      )}
    </button>
  );
}
