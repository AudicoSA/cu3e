"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import Image from "next/image";

type Props = {
  open: boolean;
  onClose: () => void;
  childId: string | null;
};

export default function VoiceTalk({ open, onClose, childId }: Props) {
  if (!open) return null;
  return (
    <ConversationProvider>
      <Overlay onClose={onClose} childId={childId} />
    </ConversationProvider>
  );
}

type Turn = { role: "user" | "assistant"; content: string };

function Overlay({ onClose, childId }: { onClose: () => void; childId: string | null }) {
  const turnsRef = useRef<Turn[]>([]);
  const conversationIdRef = useRef<string | null>(null);

  const {
    startSession,
    endSession,
    status,
    isSpeaking,
    isListening,
    isMuted,
    setMuted,
  } = useConversation({
    onMessage: (msg) => {
      // The SDK forwards every IncomingSocketEvent here.
      // We capture user transcripts and final agent responses for persistence.
      const m = msg as { type?: string; user_transcription_event?: { user_transcript?: string }; agent_response_event?: { agent_response?: string } };
      if (m.type === "user_transcript") {
        const text = m.user_transcription_event?.user_transcript?.trim();
        if (text) turnsRef.current.push({ role: "user", content: text });
      } else if (m.type === "agent_response") {
        const text = m.agent_response_event?.agent_response?.trim();
        if (text) turnsRef.current.push({ role: "assistant", content: text });
      }
    },
    onConversationMetadata: (meta) => {
      // ElevenLabs assigns the conversation id when the session starts.
      const c = (meta as { conversation_id?: string }).conversation_id;
      if (c) conversationIdRef.current = c;
    },
  });

  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const start = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      const r = await fetch("/api/voice-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `status ${r.status}`);
      }
      const data = (await r.json()) as {
        signedUrl: string;
        dynamicVariables?: Record<string, string | number | boolean>;
        ttsVoiceId?: string | null;
      };

      // Ask for mic permission before starting — clearer UX than letting the
      // SDK silently fail.
      await navigator.mediaDevices.getUserMedia({ audio: true });

      startSession({
        signedUrl: data.signedUrl,
        connectionType: "websocket",
        dynamicVariables: data.dynamicVariables ?? {},
        // Second voice for >=10 — server returns the mature voice_id when the
        // child's age band is 'big' and ELEVENLABS_VOICE_ID_MATURE is set.
        ...(data.ttsVoiceId
          ? { overrides: { tts: { voiceId: data.ttsVoiceId } } }
          : {}),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setConnecting(false);
    }
  }, [startSession, childId]);

  // Persist the captured transcript on session end (or close).
  // Then fire-and-forget the grading call so the parent dashboard reflects this
  // conversation alongside text ones.
  const flushTranscript = useCallback(async () => {
    const turns = turnsRef.current;
    if (turns.length === 0 || !childId) return;
    let savedConversationId: string | null = null;
    try {
      const r = await fetch("/api/voice-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childId,
          conversationId: conversationIdRef.current,
          turns,
        }),
      });
      if (r.ok) {
        const body = (await r.json().catch(() => ({}))) as { conversationId?: string };
        savedConversationId = body.conversationId ?? conversationIdRef.current;
      }
    } catch (err) {
      console.warn("[voice] save transcript failed:", err);
    }
    turnsRef.current = [];

    // Only grade if the call was substantial enough to mean something
    const substantialTurns = turns.filter((t) => t.content.length > 4).length;
    if (savedConversationId && substantialTurns >= 3) {
      void fetch("/api/grade-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: savedConversationId }),
      }).catch((err) => console.warn("[grade-session] voice grade failed:", err));
    }
  }, [childId]);

  const handleClose = useCallback(async () => {
    endSession();
    await flushTranscript();
    onClose();
  }, [endSession, flushTranscript, onClose]);

  // Auto-start on mount
  useEffect(() => {
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose]);

  const connected = status === "connected";

  let label = "Connecting…";
  if (error) label = "Couldn't connect";
  else if (!connected && connecting) label = "Asking for mic…";
  else if (connected && isSpeaking) label = "Echo is talking";
  else if (connected && isListening) label = "Listening — your turn";
  else if (connected) label = "Connected";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Voice conversation with Echo"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(7, 8, 13, 0.92)",
        backdropFilter: "blur(20px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 480, textAlign: "center" }}>
        {/* Animated avatar */}
        <div
          style={{
            position: "relative",
            width: 220,
            height: 220,
            margin: "0 auto 32px",
          }}
        >
          <PulseRings active={isSpeaking || isListening} variant={isSpeaking ? "speaking" : "listening"} />

          <div
            style={{
              position: "absolute",
              inset: 12,
              borderRadius: "50%",
              overflow: "hidden",
              border: "2px solid var(--border-strong)",
              boxShadow: "var(--shadow-soft)",
            }}
          >
            <Image src="/echo.png" alt="Echo" fill sizes="220px" style={{ objectFit: "cover" }} />
          </div>
        </div>

        {/* Status label */}
        <div
          className="mono"
          style={{
            fontSize: 12,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--ink-muted)",
          }}
        >
          {label}
        </div>

        <h2
          className="h-section"
          style={{
            marginTop: 12,
            fontSize: "clamp(28px, 4vw, 40px)",
            color: "var(--ink)",
          }}
        >
          {error ? (
            <>Something went wrong.</>
          ) : (
            <>Talking to <span className="serif-italic accent">Echo</span></>
          )}
        </h2>

        {error && (
          <p
            style={{
              marginTop: 16,
              color: "var(--ink-soft)",
              fontSize: 14,
              maxWidth: 360,
              margin: "16px auto 0",
            }}
          >
            {error}. Mic permission denied, or voice service unavailable. Try
            again or close this window.
          </p>
        )}

        {/* Controls */}
        <div
          style={{
            marginTop: 36,
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {error ? (
            <button onClick={start} className="btn btn-violet">
              Try again
            </button>
          ) : connected ? (
            <button
              onClick={() => setMuted(!isMuted)}
              className="btn btn-ghost"
              aria-pressed={isMuted}
            >
              {isMuted ? (
                <>
                  <MicOffIcon /> Unmute
                </>
              ) : (
                <>
                  <MicIcon /> Mute
                </>
              )}
            </button>
          ) : null}

          <button
            onClick={handleClose}
            className="btn btn-ghost"
            style={{ borderColor: "rgba(239,68,68,0.45)", color: "#fca5a5" }}
          >
            End call
          </button>
        </div>

        <p
          style={{
            marginTop: 28,
            color: "var(--ink-muted)",
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.06em",
          }}
        >
          Press Esc to end · Max 10 minutes per session
        </p>
      </div>
    </div>
  );
}

function PulseRings({
  active,
  variant,
}: {
  active: boolean;
  variant: "speaking" | "listening";
}) {
  const color = variant === "speaking" ? "var(--violet)" : "var(--cyan)";
  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: `1px solid ${color}`,
          opacity: active ? 0.6 : 0.15,
          transition: "opacity 200ms ease",
          animation: active ? "voicePulse1 1.8s ease-in-out infinite" : "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: -16,
          borderRadius: "50%",
          border: `1px solid ${color}`,
          opacity: active ? 0.35 : 0.08,
          transition: "opacity 200ms ease",
          animation: active ? "voicePulse2 2.4s ease-in-out infinite" : "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: -32,
          borderRadius: "50%",
          border: `1px solid ${color}`,
          opacity: active ? 0.18 : 0.04,
          transition: "opacity 200ms ease",
          animation: active ? "voicePulse3 3s ease-in-out infinite" : "none",
        }}
      />
      <style>{`
        @keyframes voicePulse1 { 0%,100% { transform: scale(1); } 50% { transform: scale(1.04); } }
        @keyframes voicePulse2 { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        @keyframes voicePulse3 { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
      `}</style>
    </>
  );
}

function MicIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
