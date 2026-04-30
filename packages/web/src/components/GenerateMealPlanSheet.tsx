import { useEffect, useRef, useState } from "react";
import { useGenerateMealPlan } from "../api/queries";
import { CopyMealPlanPromptButton } from "./CopyMealPlanPromptButton";
import { SparklesIcon, XIcon } from "./icons";

type Tab = "generate" | "paste";

interface GenerateMealPlanSheetProps {
  planId: string;
  open: boolean;
  canGenerate: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function GenerateMealPlanSheet({
  planId,
  open,
  canGenerate,
  onClose,
  onSuccess,
}: GenerateMealPlanSheetProps) {
  const [activeTab, setActiveTab] = useState<Tab>(() => (canGenerate ? "generate" : "paste"));

  // Generate tab state
  const [prompt, setPrompt] = useState("");
  const [generateError, setGenerateError] = useState<string | undefined>();
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const generate = useGenerateMealPlan(planId);

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
      await generate.mutateAsync({ prompt: prompt.trim() });
      setPrompt("");
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed — please try again";
      setGenerateError(message);
    }
  };

  // ---------------------------------------------------------------------------
  // Paste tab handlers
  // ---------------------------------------------------------------------------

  const handlePaste = async () => {
    setPasteError(undefined);
    try {
      await generate.mutateAsync({ rawJson: jsonText.trim() });
      setJsonText("");
      onSuccess();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to apply plan — please check the JSON";
      setPasteError(message);
    }
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
            Generate Meal Plan
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
              <p className="text-(--recipe-text) font-medium text-center">Planning your week…</p>
              <p className="text-sm text-(--recipe-muted) text-center">
                This takes about 15 seconds
              </p>
            </div>
          ) : (
            /* Generate form */
            <div className="flex flex-col flex-1 px-4 pt-4 pb-6 gap-4 overflow-y-auto">
              <div>
                <label
                  htmlFor="mealplan-prompt"
                  className="block text-sm font-medium text-(--recipe-text) mb-1.5"
                >
                  What would you like this week? *
                </label>
                <textarea
                  id="mealplan-prompt"
                  ref={promptRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="e.g. 5 weeknight dinners, one vegetarian, kid-friendly"
                  className="block w-full rounded-xl border border-(--recipe-border) bg-(--recipe-surface-raised) px-4 py-3 text-sm text-(--recipe-text) placeholder-(--recipe-muted) focus:border-(--recipe-primary) focus:outline-none focus:ring-2 focus:ring-[#d7c58f]/30 resize-none"
                />
              </div>

              <p className="text-xs text-(--recipe-muted)">
                Existing recipes from your library will be preferred. New recipes will be added
                automatically.
              </p>

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
                Generate Plan
              </button>
            </div>
          )
        ) : (
          /* Paste JSON form */
          <div className="flex flex-col flex-1 px-4 pt-4 pb-6 gap-4 overflow-y-auto">
            <CopyMealPlanPromptButton />

            <div>
              <label
                htmlFor="mealplan-paste-json"
                className="block text-sm font-medium text-(--recipe-text) mb-1.5"
              >
                Paste meal plan JSON
              </label>
              <textarea
                id="mealplan-paste-json"
                value={jsonText}
                onChange={(e) => {
                  setJsonText(e.target.value);
                  setPasteError(undefined);
                }}
                rows={8}
                placeholder='{"slots": [{"type": "existing", "day": "mon", "recipeId": "..."}, ...]}'
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
              disabled={!jsonText.trim() || isLoading}
              className="w-full rounded-xl bg-(--recipe-primary) hover:bg-[#b8c59f] active:bg-[#97a67d] disabled:opacity-50 text-(--recipe-primary-text) font-semibold py-3.5 text-base transition-colors min-h-14"
            >
              Apply Plan
            </button>
          </div>
        )}
      </div>
    </>
  );
}
