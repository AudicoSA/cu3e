"use client";

import { useEffect, useRef } from "react";

// Keeps the screen awake while the calling component is mounted. Used on
// study-hub so the kiosk tablet doesn't auto-sleep mid-session regardless
// of Android display-timeout settings — the lock is released on unmount.
//
// Wake Lock API gotcha: the browser auto-releases the lock when the tab
// becomes hidden (kid switches apps, screen turns off, etc.). On
// `visibilitychange` back to visible we re-acquire it; without this, the
// lock works once and silently dies on the second wake.
//
// Silently no-ops on browsers without navigator.wakeLock (Safari < 16.4,
// older Chromium). The Packard kiosk target is recent Chrome Android — fine.

type WakeLockSentinel = { release: () => Promise<void>; released?: boolean };
type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
};

export function useWakeLock(enabled = true) {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined") return;
    const nav = navigator as NavigatorWithWakeLock;
    if (!nav.wakeLock) return; // not supported, silently no-op

    let cancelled = false;

    const acquire = async () => {
      if (lockRef.current && lockRef.current.released === false) return;
      try {
        const lock = await nav.wakeLock!.request("screen");
        if (cancelled) {
          void lock.release().catch(() => {});
          return;
        }
        lockRef.current = lock;
      } catch (err) {
        // Permission denied, document not visible, etc. — silent, the
        // bedside screensaver still has its own wake-lock fallback.
        console.warn("[wake-lock] acquire failed:", err instanceof Error ? err.message : String(err));
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      const lock = lockRef.current;
      lockRef.current = null;
      if (lock && lock.released === false) {
        void lock.release().catch(() => {});
      }
    };
  }, [enabled]);
}
