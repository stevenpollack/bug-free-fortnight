import { useEffect, useState } from "react";
import { logger } from "./logger";

const log = logger.child("install-prompt");

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  prompt(): Promise<void>;
}

interface InstallPrompt {
  canInstall: boolean;
  install: () => Promise<void>;
}

/**
 * Listens for the browser's `beforeinstallprompt` event and exposes an
 * `install()` trigger. Suppresses the browser mini-infobar.
 *
 * Returns `canInstall: false` on iOS (no `beforeinstallprompt` support) and
 * when the app is already running in standalone mode.
 */
export function useInstallPrompt(): InstallPrompt {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const isStandalone =
    typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;

  useEffect(() => {
    if (isStandalone) {
      log.debug({ standalone: true }, "skip — already installed");
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      log.info("install prompt available");
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [isStandalone]);

  const install = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      log.info({ outcome }, "install prompt resolved");
    } catch (err) {
      log.warn(err, "install prompt failed");
    }
    setDeferredPrompt(null);
  };

  return {
    canInstall: !isStandalone && deferredPrompt !== null,
    install,
  };
}
