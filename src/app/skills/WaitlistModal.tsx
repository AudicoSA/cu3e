"use client";

import { useEffect, useState } from "react";
import type { SkillLesson } from "@/lib/skills";

type Props = {
  lesson: SkillLesson | null;
  defaultEmail?: string;
  onClose: () => void;
};

// Click-to-waitlist for the coming-soon AI Skills tiles. Posts to
// /api/skill-waitlist which upserts on (email, lesson_id) so a parent
// can register for multiple modules without duplicates.
export default function WaitlistModal({ lesson, defaultEmail, onClose }: Props) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (lesson) {
      setEmail(defaultEmail ?? "");
      setNote("");
      setStatus("idle");
      setErrorMsg(null);
    }
  }, [lesson, defaultEmail]);

  useEffect(() => {
    if (!lesson) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lesson, onClose]);

  if (!lesson) return null;

  const submit = async () => {
    if (status === "submitting") return;
    if (!email.trim()) {
      setErrorMsg("Email is required");
      return;
    }
    setStatus("submitting");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/skill-waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: lesson.id, email: email.trim(), note: note.trim() || undefined }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `status ${res.status}`);
      }
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Get notified when ${lesson.title} is ready`}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(10, 11, 16, 0.72)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 460,
          background: "var(--surface)",
          border: "1px solid var(--border-strong)",
          borderRadius: 16,
          padding: 28,
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <span className="eyebrow">Coming soon</span>
            <h3 className="h-section" style={{ marginTop: 8, fontSize: 22, lineHeight: 1.2 }}>
              {lesson.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--ink-muted)",
              fontSize: 22,
              cursor: "pointer",
              lineHeight: 1,
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        <p style={{ marginTop: 12, fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.55 }}>
          {lesson.pitch}
        </p>

        {status === "success" ? (
          <div
            style={{
              marginTop: 20,
              padding: 16,
              borderRadius: 12,
              border: "1px solid rgba(78,216,235,0.4)",
              background: "rgba(78,216,235,0.08)",
              color: "var(--cyan)",
              fontSize: 14,
              lineHeight: 1.55,
            }}
          >
            You’re on the list. We’ll email you the day this lesson goes live.
          </div>
        ) : (
          <>
            <p
              style={{
                marginTop: 20,
                fontSize: 13,
                color: "var(--ink-muted)",
                lineHeight: 1.5,
              }}
            >
              We’re building this next. Drop your email and we’ll let you know the moment it’s ready — no other emails, ever.
            </p>

            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="parent@example.com"
                aria-label="Your email"
                className="field"
                style={{ width: "100%", padding: "10px 12px", fontSize: 14 }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
              />
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Anything we should know? (optional)"
                aria-label="Note (optional)"
                rows={2}
                className="field"
                style={{ width: "100%", padding: "10px 12px", fontSize: 13, resize: "vertical", minHeight: 60 }}
              />
            </div>

            {errorMsg && (
              <div style={{ marginTop: 12, fontSize: 12, color: "var(--amber)" }}>{errorMsg}</div>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={status === "submitting"}
              className="btn btn-violet"
              style={{ marginTop: 18, width: "100%", justifyContent: "center", opacity: status === "submitting" ? 0.7 : 1 }}
            >
              {status === "submitting" ? "Adding you…" : "Notify me when it's ready"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
