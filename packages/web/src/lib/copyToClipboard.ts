/**
 * Copy text to clipboard with a fallback for non-secure contexts.
 * Throws if both the Clipboard API and the execCommand fallback fail.
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  // execCommand fallback for non-secure contexts (e.g. HTTP in dev)
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const success = document.execCommand("copy");
  document.body.removeChild(textarea);

  if (!success) {
    throw new Error("Failed to copy to clipboard");
  }
}
