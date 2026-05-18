"use client";

import { useState } from "react";

type LatestOverview = {
  id: string;
  transcript: string;
  audioUrl: string | null;
  message_count: number;
  generated_at: string;
} | null;

export default function WeeklyOverview({ latest }: { latest: LatestOverview }) {
  const [current, setCurrent] = useState<{
    transcript: string;
    audioUrl: string | null;
    messageCount: number;
  } | null>(
    latest
      ? {
          transcript: latest.transcript,
          audioUrl: latest.audioUrl,
          messageCount: latest.message_count,
        }
      : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);

  const generate = async () => {
    setError(null);
    setLoading(true);
    try {
      const r = await fetch("/api/weekly-overview/generate", { method: "POST" });
      const body = await r.json();
      if (!r.ok) {
        if (body.error === "no_activity") {
          setError(body.detail ?? "Nothing to summarise yet.");
        } else {
          setError(body.detail ?? body.error ?? `Failed (status ${r.status}).`);
        }
        return;
      }
      setCurrent({
        transcript: body.transcript,
        audioUrl: body.audioUrl,
        messageCount: body.messageCount,
      });
      setShowTranscript(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 28,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <span className="eyebrow">For your ears</span>
          <h3 className="h-section" style={{ marginTop: 10, fontSize: 24, lineHeight: 1.2 }}>
            Weekly <span className="serif-italic accent">audio overview</span>
          </h3>
          <p style={{ marginTop: 10, fontSize: 14, color: "var(--ink-muted)", maxWidth: 520, lineHeight: 1.55 }}>
            Echo summarises what your kids worked on this week — for you, by voice. Pop it in your headphones on the school run.
          </p>
        </div>

        <button onClick={generate} disabled={loading} className="btn btn-violet" style={{ opacity: loading ? 0.6 : 1, cursor: loading ? "wait" : "pointer" }}>
          {loading ? (
            <>
              <Spinner /> Generating…
            </>
          ) : current ? (
            <>
              <RegenIcon /> Generate again
            </>
          ) : (
            <>
              <PlayIcon /> Generate this week
            </>
          )}
        </button>
      </div>

      {loading && (
        <p style={{ marginTop: 18, fontSize: 13, color: "var(--ink-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>
          Summarising · Synthesising voice · Roughly 20–40 seconds…
        </p>
      )}

      {error && !loading && (
        <div
          style={{
            marginTop: 18,
            borderRadius: 10,
            border: "1px solid rgba(245,158,11,0.4)",
            background: "rgba(245,158,11,0.1)",
            color: "var(--amber)",
            padding: "10px 14px",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {current && !loading && (
        <div style={{ marginTop: 22 }}>
          {current.audioUrl ? (
            <audio controls src={current.audioUrl} style={{ width: "100%" }}>
              Your browser doesn&apos;t support audio playback.
            </audio>
          ) : (
            <p style={{ fontSize: 13, color: "var(--ink-muted)", fontStyle: "italic" }}>
              Audio not available — read the transcript below.
            </p>
          )}

          <div
            style={{
              marginTop: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <span
              style={{
                fontSize: 11.5,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.06em",
                color: "var(--ink-muted)",
              }}
            >
              {current.messageCount} message{current.messageCount === 1 ? "" : "s"} summarised
            </span>
            <button
              onClick={() => setShowTranscript((v) => !v)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--violet)",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {showTranscript ? "Hide transcript" : "Read transcript"}
            </button>
          </div>

          {showTranscript && (
            <div
              style={{
                marginTop: 14,
                fontSize: 14,
                lineHeight: 1.7,
                color: "var(--ink-soft)",
                whiteSpace: "pre-wrap",
                background: "var(--bg-elev)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: 18,
                maxHeight: 360,
                overflowY: "auto",
              }}
            >
              {current.transcript}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span
      style={{
        width: 12,
        height: 12,
        border: "2px solid currentColor",
        borderTopColor: "transparent",
        borderRadius: "50%",
        display: "inline-block",
        animation: "spin 1s linear infinite",
      }}
    />
  );
}
function PlayIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  );
}
function RegenIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}
