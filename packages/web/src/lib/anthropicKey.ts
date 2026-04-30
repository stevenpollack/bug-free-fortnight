const STORAGE_KEY = "anthropicApiKey";

export function getAnthropicKey(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function setAnthropicKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key);
  // Dispatch storage event so useSyncExternalStore listeners on the same tab are notified.
  // (cross-tab notifications are automatic; same-tab requires manual dispatch)
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
}

export function clearAnthropicKey(): void {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
}
