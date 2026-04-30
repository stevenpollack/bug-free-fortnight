import { useState } from "react";
import { useTestAnthropicKey } from "../api/queries";
import { Page } from "../components/Page";
import { CheckIcon, XIcon } from "../components/icons";
import { clearAnthropicKey, getAnthropicKey, setAnthropicKey } from "../lib/anthropicKey";

type TestStatus = "idle" | "pending" | "ok" | "error";

export function Settings() {
  const [keyInput, setKeyInput] = useState(() => getAnthropicKey() ?? "");
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testMessage, setTestMessage] = useState("");
  const [saved, setSaved] = useState(false);

  const testMutation = useTestAnthropicKey();

  const handleSave = () => {
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    setAnthropicKey(trimmed);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setTestStatus("idle");
  };

  const handleTest = async () => {
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    setTestStatus("pending");
    setTestMessage("");
    try {
      await testMutation.mutateAsync(trimmed);
      setTestStatus("ok");
      setTestMessage("Key is valid.");
    } catch (err) {
      setTestStatus("error");
      setTestMessage(err instanceof Error ? err.message : "Key test failed");
    }
  };

  const handleClear = () => {
    clearAnthropicKey();
    setKeyInput("");
    setTestStatus("idle");
    setTestMessage("");
  };

  const hasStoredKey = Boolean(getAnthropicKey());

  return (
    <Page className="py-4 max-w-lg">
      <h1 className="text-xl font-bold text-(--recipe-text) mb-6">Settings</h1>

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-(--recipe-text) mb-1">Anthropic API Key</h2>
          <p className="text-sm text-(--recipe-muted) mb-3">
            Add your own Anthropic API key to enable in-app recipe generation on this device.
          </p>

          {/* Key input */}
          <label
            htmlFor="api-key"
            className="block text-sm font-medium text-(--recipe-text) mb-1.5"
          >
            Anthropic API key
          </label>
          <div className="relative">
            <input
              id="api-key"
              type={showKey ? "text" : "password"}
              value={keyInput}
              onChange={(e) => {
                setKeyInput(e.target.value);
                setTestStatus("idle");
              }}
              placeholder="sk-ant-..."
              className="block w-full rounded-xl border border-(--recipe-border) bg-(--recipe-surface-raised) px-4 py-3 pr-12 text-sm text-(--recipe-text) placeholder-(--recipe-muted) focus:border-(--recipe-primary) focus:outline-none focus:ring-2 focus:ring-[#d7c58f]/30"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? "Hide API key" : "Show API key"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-(--recipe-muted) hover:text-(--recipe-text) transition-colors p-1"
            >
              {showKey ? <XIcon className="size-4" /> : <CheckIcon className="size-4" />}
            </button>
          </div>

          {/* Test status */}
          {testStatus !== "idle" && (
            <div
              className={`mt-2 flex items-center gap-2 text-sm ${
                testStatus === "ok"
                  ? "text-green-400"
                  : testStatus === "error"
                    ? "text-(--recipe-destructive)"
                    : "text-(--recipe-muted)"
              }`}
            >
              {testStatus === "ok" && <CheckIcon className="size-4" />}
              {testStatus === "error" && <XIcon className="size-4" />}
              {testStatus === "pending" ? "Testing…" : testMessage}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!keyInput.trim()}
            className="rounded-xl bg-(--recipe-primary) hover:bg-[#b8c59f] active:bg-[#97a67d] disabled:opacity-50 text-(--recipe-primary-text) font-semibold px-5 py-2.5 text-sm transition-colors min-h-11"
          >
            {saved ? "Saved!" : "Save"}
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={!keyInput.trim() || testStatus === "pending"}
            className="rounded-xl border border-(--recipe-border) text-(--recipe-text) hover:border-(--recipe-accent) disabled:opacity-50 font-medium px-5 py-2.5 text-sm transition-colors min-h-11"
          >
            Test key
          </button>
          {hasStoredKey && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded-xl border border-(--recipe-destructive) text-(--recipe-destructive) hover:bg-[#2f1f1b] font-medium px-5 py-2.5 text-sm transition-colors min-h-11"
            >
              Clear
            </button>
          )}
        </div>

        {/* Disclosure */}
        <div className="rounded-xl border border-(--recipe-border) bg-(--recipe-surface-raised) p-4 text-sm text-(--recipe-muted) space-y-2">
          <p className="font-medium text-(--recipe-text)">Privacy note</p>
          <p>
            Your API key is stored unencrypted in this browser only (localStorage). It is never sent
            to anyone except this household's own server, which forwards it to Anthropic on your
            behalf — keeping it out of browser network logs.
          </p>
          <p>
            The key persists until you clear it here or clear site data in your browser settings.
          </p>
        </div>
      </section>
    </Page>
  );
}
