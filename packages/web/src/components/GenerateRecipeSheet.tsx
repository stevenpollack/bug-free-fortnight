import { useEffect, useRef, useState } from "react";
import { RecipeCreate } from "../../../api/src/schemas/index.ts";
import { useGenerateRecipe } from "../api/queries";
import { SparklesIcon, XIcon } from "./icons";

type Tab = "generate" | "paste";

interface GenerateRecipeSheetProps {
  open: boolean;
  canGenerate: boolean;
  onClose: () => void;
  onGenerated: (recipe: RecipeCreate) => void;
}

export function GenerateRecipeSheet({
  open,
  canGenerate,
  onClose,
  onGenerated,
}: GenerateRecipeSheetProps) {
  const [activeTab, setActiveTab] = useState<Tab>(() => (canGenerate ? "generate" : "paste"));

  // Generate tab state
  const [prompt, setPrompt] = useState("");
  const [servings, setServings] = useState("");
  const [dietary, setDietary] = useState("");
  const [generateError, setGenerateError] = useState<string | undefined>();
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const generate = useGenerateRecipe();

  // Paste tab state
  const [jsonText, setJsonText] = useState("");
  const [pasteError, setPasteError] = useState<string | undefined>();

  // Reset to sensible default tab when sheet opens
  useEffect(() => {
    if (open) {
      setActiveTab(canGenerate ? "generate" : "paste");
    }
  }, [open, canGenerate]);

  // Prevent body scroll while sheet is open
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Focus prompt textarea when generate tab becomes active
  useEffect(() => {
    if (open && activeTab === "generate") {
      setTimeout(() => promptRef.current?.focus(), 50);
    }
  }, [open, activeTab]);

  if (!open) return null;

  const isLoading = generate.isPending;

  // ---------------------------------------------------------------------------
  // Generate tab handlers
  // ---------------------------------------------------------------------------

  const canSubmitGenerate = prompt.trim().length > 0 && !isLoading;

  const handleGenerate = async () => {
    if (!canSubmitGenerate) return;
    setGenerateError(undefined);
    try {
      const servingsNum = servings.trim() ? Number.parseInt(servings, 10) : undefined;
      const result = await generate.mutateAsync({
        prompt: prompt.trim(),
        servings: servingsNum && !Number.isNaN(servingsNum) ? servingsNum : undefined,
        dietary: dietary.trim() || undefined,
      });
      onGenerated(result.recipe);
      setPrompt("");
      setServings("");
      setDietary("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed — please try again";
      setGenerateError(message);
    }
  };

  // ---------------------------------------------------------------------------
  // Paste tab handlers
  // ---------------------------------------------------------------------------

  const handlePaste = () => {
    setPasteError(undefined);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setPasteError("Invalid JSON — check for missing commas or brackets");
      return;
    }

    const result = RecipeCreate.safeParse(parsed);
    if (!result.success) {
      const issues = result.error.issues;
      const messages = issues.map((issue) => {
        const path = issue.path.join(".");
        return path ? `${path}: ${issue.message}` : issue.message;
      });
      setPasteError(messages.join("; "));
      return;
    }

    onGenerated(result.data);
    setJsonText("");
  };

  // ---------------------------------------------------------------------------
  // Tab button styles
  // ---------------------------------------------------------------------------

  const tabCls = (tab: Tab) =>
    activeTab === tab
      ? "pb-2 text-sm font-medium text-(--recipe-text) border-b-2 border-(--recipe-primary) transition-colors"
      : "pb-2 text-sm font-medium text-(--recipe-muted) border-b-2 border-transparent hover:text-(--recipe-text) transition-colors";

  return (
    <>
      {/* Backdrop */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop is aria-hidden; keyboard users close via button */}
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} aria-hidden="true" />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-(--recipe-surface) border-t border-(--recipe-border) flex flex-col max-h-[85dvh]">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-(--recipe-border)" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3">
          <h2 className="font-semibold text-(--recipe-text) flex items-center gap-2">
            <SparklesIcon className="size-5 text-(--recipe-accent)" />
            Add Recipe
          </h2>
          {!isLoading && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-2 rounded-full hover:bg-(--recipe-surface-raised) transition-colors min-h-11 min-w-11 flex items-center justify-center"
            >
              <XIcon className="size-5" />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-5 px-4 border-b border-(--recipe-border) mb-1">
          {canGenerate ? (
            <button
              type="button"
              onClick={() => setActiveTab("generate")}
              className={tabCls("generate")}
            >
              Generate
            </button>
          ) : (
            <span
              className="pb-2 text-sm font-medium text-(--recipe-muted) border-b-2 border-transparent cursor-not-allowed opacity-50"
              title="Requires API key configuration"
            >
              Generate
            </span>
          )}
          <button type="button" onClick={() => setActiveTab("paste")} className={tabCls("paste")}>
            Paste JSON
          </button>
        </div>

        {/* Tab content */}
        {activeTab === "generate" && canGenerate ? (
          isLoading ? (
            /* Loading state */
            <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 gap-4">
              <SparklesIcon className="size-10 text-(--recipe-accent) animate-pulse" />
              <p className="text-(--recipe-text) font-medium text-center">
                Thinking through your recipe…
              </p>
              <p className="text-sm text-(--recipe-muted) text-center">
                This takes about 10 seconds
              </p>
            </div>
          ) : (
            /* Generate form */
            <div className="flex flex-col flex-1 px-4 pt-4 pb-6 gap-4 overflow-y-auto">
              <div>
                <label
                  htmlFor="generate-prompt"
                  className="block text-sm font-medium text-(--recipe-text) mb-1.5"
                >
                  What recipe would you like? *
                </label>
                <textarea
                  id="generate-prompt"
                  ref={promptRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="e.g. A quick weeknight pasta with bacon and cream, serves 4"
                  className="block w-full rounded-xl border border-(--recipe-border) bg-(--recipe-surface-raised) px-4 py-3 text-sm text-(--recipe-text) placeholder-(--recipe-muted) focus:border-(--recipe-primary) focus:outline-none focus:ring-2 focus:ring-[#d7c58f]/30 resize-none"
                />
              </div>

              <div>
                <label
                  htmlFor="generate-servings"
                  className="block text-sm font-medium text-(--recipe-text) mb-1.5"
                >
                  Servings (optional)
                </label>
                <input
                  id="generate-servings"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={servings}
                  onChange={(e) => setServings(e.target.value)}
                  placeholder="e.g. 4"
                  className="block w-full rounded-xl border border-(--recipe-border) bg-(--recipe-surface-raised) px-4 py-3 text-sm text-(--recipe-text) placeholder-(--recipe-muted) focus:border-(--recipe-primary) focus:outline-none focus:ring-2 focus:ring-[#d7c58f]/30"
                />
              </div>

              <div>
                <label
                  htmlFor="generate-dietary"
                  className="block text-sm font-medium text-(--recipe-text) mb-1.5"
                >
                  Dietary requirements (optional)
                </label>
                <input
                  id="generate-dietary"
                  type="text"
                  value={dietary}
                  onChange={(e) => setDietary(e.target.value)}
                  maxLength={500}
                  placeholder="e.g. gluten-free, dairy-free, vegan"
                  className="block w-full rounded-xl border border-(--recipe-border) bg-(--recipe-surface-raised) px-4 py-3 text-sm text-(--recipe-text) placeholder-(--recipe-muted) focus:border-(--recipe-primary) focus:outline-none focus:ring-2 focus:ring-[#d7c58f]/30"
                />
              </div>

              {generateError && (
                <div className="rounded-lg bg-[#2f1f1b] border border-(--recipe-destructive) p-4">
                  <p className="text-sm text-(--recipe-destructive)">{generateError}</p>
                </div>
              )}

              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canSubmitGenerate}
                className="w-full rounded-xl bg-(--recipe-primary) hover:bg-[#b8c59f] active:bg-[#97a67d] disabled:opacity-50 text-(--recipe-primary-text) font-semibold py-3.5 text-base transition-colors min-h-14 flex items-center justify-center gap-2"
              >
                <SparklesIcon className="size-5" />
                Generate Recipe
              </button>
            </div>
          )
        ) : (
          /* Paste JSON form */
          <div className="flex flex-col flex-1 px-4 pt-4 pb-6 gap-4 overflow-y-auto">
            <div>
              <label
                htmlFor="paste-json"
                className="block text-sm font-medium text-(--recipe-text) mb-1.5"
              >
                Paste recipe JSON
              </label>
              <textarea
                id="paste-json"
                value={jsonText}
                onChange={(e) => {
                  setJsonText(e.target.value);
                  setPasteError(undefined);
                }}
                rows={8}
                placeholder={'{"title": "...", "ingredients": [...], "instructions": [...]}'}
                className="block w-full rounded-xl border border-(--recipe-border) bg-(--recipe-surface-raised) px-4 py-3 text-sm font-mono text-(--recipe-text) placeholder-(--recipe-muted) focus:border-(--recipe-primary) focus:outline-none focus:ring-2 focus:ring-[#d7c58f]/30 resize-none"
              />
            </div>

            {pasteError && (
              <div className="rounded-lg bg-[#2f1f1b] border border-(--recipe-destructive) p-4">
                <p className="text-sm text-(--recipe-destructive)">{pasteError}</p>
              </div>
            )}

            <button
              type="button"
              onClick={handlePaste}
              disabled={!jsonText.trim()}
              className="w-full rounded-xl bg-(--recipe-primary) hover:bg-[#b8c59f] active:bg-[#97a67d] disabled:opacity-50 text-(--recipe-primary-text) font-semibold py-3.5 text-base transition-colors min-h-14"
            >
              Load Recipe
            </button>
          </div>
        )}
      </div>
    </>
  );
}
