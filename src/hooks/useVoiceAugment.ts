"use client";

import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";

// Voice-augment a normal text chat:
//  - Echo's assistant turns are spoken aloud (browser SpeechSynthesis) one
//    sentence at a time as they stream in.
//  - The user's microphone is continuously listened to (browser
//    SpeechRecognition); interim results stream into the chat input via
//    onInterim, and a final result (when the user pauses) auto-submits via
//    onUserSpeech.
//
// Mic is paused while Echo is speaking so we don't pick up her own voice.
// Mic resumes the moment TTS finishes the last queued utterance.
//
// Browser support:
//  - SpeechSynthesis: all modern browsers (Chrome, Edge, Safari, Firefox).
//  - SpeechRecognition: webkit-prefixed on most Chromium browsers (Android
//    Chrome works). Firefox and iOS Safari don't expose it — we silently no-op.
type Props = {
  enabled: boolean;
  messages: UIMessage[];
  isLoading: boolean;
  onUserSpeech: (text: string) => void;
  onInterim: (text: string) => void;
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

export function useVoiceAugment({
  enabled,
  messages,
  isLoading,
  onUserSpeech,
  onInterim,
}: Props) {
  // Tracks how many characters of each assistant message have already been
  // queued for TTS, so we don't re-speak on every render as more streams in.
  const spokenSoFar = useRef<Map<string, number>>(new Map());
  const isSpeakingRef = useRef(false);
  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);
  const wantsListeningRef = useRef(false);

  // ----- TTS effect — speak new assistant text as it streams -----
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    for (const m of messages) {
      if (m.role !== "assistant") continue;
      const fullText =
        m.parts
          ?.filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
          .map((p) => p.text)
          .join("") ?? "";
      if (!fullText) continue;

      const spoken = spokenSoFar.current.get(m.id) ?? 0;
      const remaining = fullText.slice(spoken);
      if (remaining.length === 0) continue;

      // Speak whole sentences only. If we're still streaming and there isn't
      // a sentence boundary yet, wait for the next render.
      const sentenceMatch = remaining.match(/^[\s\S]*?[.?!](?:\s|$)/);
      const isStillStreaming = isLoading && m === messages[messages.length - 1];
      let segment: string;
      if (sentenceMatch) {
        segment = sentenceMatch[0];
      } else if (!isStillStreaming) {
        // Stream is done — flush whatever's left even without trailing
        // punctuation.
        segment = remaining;
      } else {
        continue;
      }

      const trimmed = segment.trim();
      spokenSoFar.current.set(m.id, spoken + segment.length);
      if (!trimmed) continue;

      const utter = new SpeechSynthesisUtterance(trimmed);
      utter.rate = 1.0;
      utter.pitch = 1.05;
      utter.onstart = () => {
        isSpeakingRef.current = true;
        // Pause the mic while Echo is talking so it doesn't transcribe her.
        try {
          recognitionRef.current?.stop();
        } catch {
          /* idempotent */
        }
      };
      utter.onend = () => {
        isSpeakingRef.current = false;
        // Resume listening once nothing else is queued.
        if (
          enabled &&
          !window.speechSynthesis.speaking &&
          wantsListeningRef.current &&
          recognitionRef.current
        ) {
          try {
            recognitionRef.current.start();
          } catch {
            /* may already be running */
          }
        }
      };
      window.speechSynthesis.speak(utter);
    }
  }, [enabled, messages, isLoading]);

  // ----- STT effect — continuous listening -----
  useEffect(() => {
    if (!enabled) {
      // Disabling clears everything.
      wantsListeningRef.current = false;
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
      // Also cancel any speech in flight.
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      spokenSoFar.current.clear();
      return;
    }
    if (typeof window === "undefined") return;

    const W = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SR) {
      console.warn("[voice-augment] SpeechRecognition not supported in this browser");
      return;
    }

    const rec = new SR();
    rec.continuous = false; // browsers handle continuous unreliably; auto-restart on end instead
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const transcript = res[0].transcript;
        if (res.isFinal) final += transcript;
        else interim += transcript;
      }
      if (interim) onInterim(interim);
      if (final.trim()) onUserSpeech(final.trim());
    };

    rec.onend = () => {
      // Auto-restart unless we've been disabled or Echo is currently speaking.
      if (
        wantsListeningRef.current &&
        !isSpeakingRef.current &&
        !window.speechSynthesis.speaking
      ) {
        try {
          rec.start();
        } catch {
          /* already started */
        }
      }
    };

    rec.onerror = (event: { error?: string }) => {
      // "no-speech" / "aborted" are normal — silence + manual stop. Only log
      // anything genuinely surprising.
      if (event.error && !["no-speech", "aborted", "audio-capture"].includes(event.error)) {
        console.warn("[voice-augment] recognition error:", event.error);
      }
    };

    recognitionRef.current = rec;
    wantsListeningRef.current = true;

    // Don't start mic while Echo is mid-stream — wait for the TTS to finish
    // its current burst.
    if (!isSpeakingRef.current && !window.speechSynthesis.speaking) {
      try {
        rec.start();
      } catch {
        /* ignore */
      }
    }

    return () => {
      wantsListeningRef.current = false;
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    };
  }, [enabled, onInterim, onUserSpeech]);

  // Clear the "spoken so far" tracker whenever the conversation resets (new
  // chat id). Caller forces that by remounting the consumer — useful for
  // mode switches where messages get cleared.
}
