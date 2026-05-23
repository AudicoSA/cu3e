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
  // Last time something happened that means the kid is still engaged — either
  // a user transcript landed OR Echo was mid-sentence. We use this to drive
  // the auto-end-on-silence (Echo Sleep) below.
  const lastActivityRef = useRef<number>(Date.now());
  // The activity ref above is updated from inside the SDK callback (which
  // closes over the *initial* value) — so we read isSpeaking from a ref too
  // to avoid stale closures in the silence-watch interval.
  const isSpeakingRef = useRef<boolean>(false);

  // Pending close from a detected sleep ack. We schedule handleClose ~3s
  // out so Echo's spoken acknowledgement actually finishes playing before
  // the WebSocket drops. Stored as a ref so any subsequent agent re-engage
  // (Echo trying to chat after saying she'll be quiet) doesn't cancel the
  // scheduled close.
  const sleepCloseTimerRef = useRef<number | null>(null);
  // Armed when the KID asks Echo to sleep/be quiet/say goodnight. Once
  // armed, Echo's very next reply triggers the close (regardless of whether
  // it sounds like an ack) so we don't depend on the model phrasing things
  // a particular way.
  const sleepArmedRef = useRef<boolean>(false);

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
        if (text) {
          turnsRef.current.push({ role: "user", content: text });
          lastActivityRef.current = Date.now();
          // Did the kid ask Echo to sleep/stop? Arm the close — Echo's
          // next reply (whether it's a clean "ok goodnight" or some other
          // phrasing) will trigger the scheduled close below.
          const sleepIntent =
            /\b(go (to )?sleep|be quiet|stop talking|shush|goodnight|good night|bye echo|i'?m (tired|done|going to sleep)|that'?s enough|we'?re done)\b/i;
          if (sleepIntent.test(text)) sleepArmedRef.current = true;
        }
      } else if (m.type === "agent_response") {
        const text = m.agent_response_event?.agent_response?.trim();
        if (text) {
          turnsRef.current.push({ role: "assistant", content: text });
          lastActivityRef.current = Date.now();
          // Schedule a clean close ~3s out (lets the spoken reply finish
          // before the WebSocket drops) when EITHER:
          //   (a) The kid armed sleep on the previous turn — any reply
          //       from Echo now closes the call. Robust against the model
          //       not phrasing the ack the way our regex expects.
          //   (b) Echo independently produced a sleep-ack phrase (e.g. she
          //       picked up a "go quiet" cue from earlier context).
          // Once scheduled we never re-arm — any subsequent re-engage turn
          // from EL is exactly the loop we're escaping.
          if (sleepCloseTimerRef.current === null) {
            const sleepAck =
              /\bi'?ll be (quiet|here when|on standby)\b|\bi'?ll (wait|stop talking|let you (rest|sleep))\b|\blet me know (if|when) you need me\b|\bgoing quiet\b|\bgoodnight\b/i;
            if (sleepArmedRef.current || sleepAck.test(text)) {
              sleepCloseTimerRef.current = window.setTimeout(() => {
                void handleCloseRef.current?.();
              }, 3000);
            }
          }
        }
      }
    },
    onConversationMetadata: (meta) => {
      // ElevenLabs assigns the conversation id when the session starts.
      const c = (meta as { conversation_id?: string }).conversation_id;
      if (c) conversationIdRef.current = c;
    },
    // Surface any EL error to the UI + console. Without this, override
    // rejections (bad voice_id, disallowed language override, etc.) fail
    // silently — the modal sits on "Connecting" forever.
    onError: (err) => {
      const msg =
        typeof err === "string"
          ? err
          : (err as { message?: string })?.message ?? JSON.stringify(err);
      console.error("[voice] EL error:", err);
      setError(`Voice error: ${msg}`);
    },
    onDisconnect: (info) => {
      // Disconnect with a reason that isn't a normal user-close = surface it
      // so we know what happened.
      const reason = (info as { reason?: string; message?: string })?.reason
        ?? (info as { reason?: string; message?: string })?.message;
      if (reason && reason !== "user") {
        console.warn("[voice] EL disconnect:", info);
      }
    },
  });

  // Track isSpeaking on a ref so the silence-watch interval below sees the
  // current value without re-arming on every render.
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
    if (isSpeaking) lastActivityRef.current = Date.now();
  }, [isSpeaking]);

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
        languageCode?: string | null;
      };

      // Ask for mic permission before starting — clearer UX than letting the
      // SDK silently fail.
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Merge any per-session EL overrides. Two we use today:
      //   tts.voiceId  — mature voice for age >=10 (env-var driven)
      //   agent.language — child's preferred language (en/af/zu) so EL's
      //                    STT + agent know which language to expect.
      // EL's `language` field is a typed enum at the SDK boundary; we cast
      // to satisfy TS since our runtime ISO-639-1 codes match the enum
      // values EL accepts.
      const ttsOverride = data.ttsVoiceId ? { voiceId: data.ttsVoiceId } : null;
      // TEMPORARILY DISABLED — EL was closing the WebSocket on connect when
      // we passed agent.language='af'/'zu' overrides. The override permission
      // is enabled on the agent (tts.voice_id + agent.language both true),
      // but EL likely requires the language to be pre-registered in the
      // agent's language_presets (which our PATCH attempts couldn't set
      // remotely — possibly UI-only or premium-tier). Disabling the language
      // override means EL's STT defaults to English; Adele's voice still
      // speaks Afrikaans (her native accent), and our custom LLM still
      // generates Afrikaans output via the system-prompt directive — so
      // Echo still speaks Afrikaans, just with EL's English-mode STT
      // listening. We re-enable this when language_presets is figured out.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const agentOverride: { language: any } | null = null;
      void data.languageCode;

      startSession({
        signedUrl: data.signedUrl,
        connectionType: "websocket",
        dynamicVariables: data.dynamicVariables ?? {},
        ...(ttsOverride || agentOverride
          ? {
              overrides: {
                ...(ttsOverride ? { tts: ttsOverride } : {}),
                ...(agentOverride ? { agent: agentOverride } : {}),
              },
            }
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
    if (sleepCloseTimerRef.current !== null) {
      window.clearTimeout(sleepCloseTimerRef.current);
      sleepCloseTimerRef.current = null;
    }
    endSession();
    await flushTranscript();
    onClose();
  }, [endSession, flushTranscript, onClose]);

  // The SDK's onMessage callback is captured at mount and would close over
  // a stale handleClose. Stash the current ref so the sleep-ack timer can
  // call the latest version.
  const handleCloseRef = useRef(handleClose);
  useEffect(() => {
    handleCloseRef.current = handleClose;
  }, [handleClose]);

  // Auto-start on mount
  useEffect(() => {
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flush on disconnect — covers internet drops, EL-side timeouts, anything
  // that ends the websocket without going through handleClose. Without this,
  // a kid who loses wifi mid-conversation comes back to a fresh Echo that
  // has no idea what they were just talking about. flushTranscript itself
  // is a no-op when turns are empty, so double-flushes from the normal
  // End-call path are safe.
  const prevStatusRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (prev === "connected" && status !== "connected") {
      void flushTranscript();
    }
  }, [status, flushTranscript]);

  // Close on Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose]);

  // Echo Sleep — auto-end the EL session after a stretch of true silence.
  // The system prompt asks Echo to stay quiet during silence, but EL keeps
  // the WebSocket open (and the meter running) until the client closes it.
  // This is the hard stop. lastActivityRef is bumped by user transcripts,
  // agent responses, and any time Echo is mid-speech, so we only end when
  // there's been genuine quiet on both sides for the threshold window.
  const SILENCE_MS = 45_000; // ~45s of true two-way silence ends the call
  useEffect(() => {
    if (status !== "connected") return;
    // Anchor activity at connect so a slow first reply doesn't trip the timer
    // before the kid has even spoken.
    lastActivityRef.current = Date.now();
    const id = window.setInterval(() => {
      if (isSpeakingRef.current) {
        lastActivityRef.current = Date.now();
        return;
      }
      if (Date.now() - lastActivityRef.current > SILENCE_MS) {
        void handleClose();
      }
    }, 5_000);
    return () => window.clearInterval(id);
  }, [status, handleClose]);

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
          Press Esc to end · Auto-sleeps after 45s of silence
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
