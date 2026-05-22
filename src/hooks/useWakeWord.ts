"use client";

import { useEffect, useRef } from "react";

// Continuous-listen "Echo" wake word for the kiosk-bedside experience.
// Uses the browser's Web Speech API (webkit-prefixed SpeechRecognition on
// Chromium; the same flavour useVoiceAugment uses). Stays on as long as
// `enabled` is true, watches interim transcripts for the configured keyword,
// fires `onWake` and self-quiets for a moment to avoid double-firing.
//
// Caveat: Chrome's Web Speech API streams audio to Google for recognition.
// Fine for the personal kiosk (Kenny + family); should be upgraded to an
// on-device wake-word engine (Porcupine / Picovoice) before wider rollout.
//
// Browser support: Chromium browsers (Chrome on Android = the kiosk target).
// Firefox and iOS Safari don't expose SpeechRecognition — we silently no-op
// so nothing breaks on parent's desktop.

type Props = {
  enabled: boolean;
  // The phrase to listen for. Case-insensitive substring match against
  // interim transcripts. Default "echo".
  keyword?: string;
  // Fired when the keyword is detected. Caller is responsible for any UI
  // response (open voice modal, exit screensaver, etc.). After firing we
  // pause listening for `cooldownMs` to avoid the same utterance re-firing.
  onWake: () => void;
  // Cooldown after a successful wake before we start listening again.
  // Default 2.5s — long enough to avoid double-triggering on the kid's
  // continued speech ("Echo, tell me a story"), short enough that we're
  // ready by the time they pause.
  cooldownMs?: number;
};

type MinimalSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionEvent = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
};

type SpeechRecognitionCtor = new () => MinimalSpeechRecognition;

export function useWakeWord({
  enabled,
  keyword = "echo",
  onWake,
  cooldownMs = 2500,
}: Props) {
  // Keep onWake in a ref so the recognition handlers always see the latest
  // closure without us having to recreate the recognition object every time.
  const onWakeRef = useRef(onWake);
  useEffect(() => {
    onWakeRef.current = onWake;
  }, [onWake]);

  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);
  const cooldownUntilRef = useRef<number>(0);
  // Track whether we WANT it on, so the auto-restart in `onend` knows
  // whether to come back or stay quiet.
  const wantOnRef = useRef(false);

  useEffect(() => {
    wantOnRef.current = enabled;

    if (typeof window === "undefined") return;
    const Ctor: SpeechRecognitionCtor | undefined =
      (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition;
    if (!Ctor) return; // Browser doesn't support it — silently no-op.

    if (!enabled) {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      return;
    }

    const lowered = keyword.toLowerCase();

    const recog = new Ctor();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = "en-US";

    recog.onresult = (event) => {
      if (Date.now() < cooldownUntilRef.current) return;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.toLowerCase();
        if (transcript.includes(lowered)) {
          cooldownUntilRef.current = Date.now() + cooldownMs;
          onWakeRef.current();
          return;
        }
      }
    };

    recog.onend = () => {
      // Chrome stops the recogniser after natural silences. If we still
      // want it on, restart it. Small delay to avoid tight error loops.
      if (!wantOnRef.current) return;
      window.setTimeout(() => {
        if (wantOnRef.current && recognitionRef.current === recog) {
          try {
            recog.start();
          } catch {
            // Already started or in a transient state — next tick will fix.
          }
        }
      }, 200);
    };

    recog.onerror = (e) => {
      // 'no-speech' and 'aborted' are normal lifecycle events; ignore.
      // Anything else, log and let onend handle restart.
      if (e.error && e.error !== "no-speech" && e.error !== "aborted") {
        console.warn("[wake-word] error:", e.error);
      }
    };

    try {
      recog.start();
    } catch (err) {
      console.warn("[wake-word] failed to start:", err instanceof Error ? err.message : String(err));
    }
    recognitionRef.current = recog;

    return () => {
      wantOnRef.current = false;
      try {
        recog.abort();
      } catch {
        /* ignore */
      }
      if (recognitionRef.current === recog) recognitionRef.current = null;
    };
  }, [enabled, keyword, cooldownMs]);
}
