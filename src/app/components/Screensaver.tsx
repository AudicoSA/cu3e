"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

// Bedside-companion screensaver. Full-screen takeover after a period of
// inactivity that turns the kiosk tablet into a quiet presence in the room
// rather than a glowing chrome tab.
//
// Controlled component — parent owns the `active` flag so the wake-word
// handler can dismiss the overlay imperatively (say "Echo" → exit AND open
// voice mode in one motion). Idle detection lives inside the component;
// when the timer expires it calls onActiveChange(true) and the parent flips
// active. Click / Esc inside the overlay calls onActiveChange(false).
//
// Wake Lock API keeps the display alive past Android's normal screen-off so
// the kid can see the owl from across the room. Tablet idle-sleep stays
// disabled while the overlay is up.

type Props = {
  enabled: boolean;
  active: boolean;
  onActiveChange: (active: boolean) => void;
  // Ms of idle time before the overlay fires. Default 90s.
  idleMs?: number;
  // True while the chat is mid-stream or voice modal is open — suppress
  // idle counting entirely so a kid reading a long Echo reply doesn't get
  // bumped to screensaver.
  busy?: boolean;
  // Reflects whether wake-word listening is currently armed. Drives the
  // visible "I'm listening" dot under the clock.
  wakeWordArmed?: boolean;
};

export default function Screensaver({
  enabled,
  active,
  onActiveChange,
  idleMs = 90_000,
  busy = false,
  wakeWordArmed = false,
}: Props) {
  const timerRef = useRef<number | null>(null);
  const wakeLockRef = useRef<unknown>(null);
  const [now, setNow] = useState<Date>(() => new Date());

  // Idle timer: armed when the master enable is on and we're not busy and
  // the overlay isn't already up. Reset on any user input.
  useEffect(() => {
    if (!enabled || busy || active) {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const arm = () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => onActiveChange(true), idleMs);
    };

    arm();

    const events: Array<keyof WindowEventMap> = [
      "pointerdown",
      "pointermove",
      "keydown",
      "touchstart",
      "wheel",
    ];
    for (const ev of events) window.addEventListener(ev, arm, { passive: true });

    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      for (const ev of events) window.removeEventListener(ev, arm);
    };
  }, [enabled, busy, active, idleMs, onActiveChange]);

  // Tick the clock once a minute while active so the minute display updates.
  useEffect(() => {
    if (!active) return;
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, [active]);

  // Wake Lock while overlay is up.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    (async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (kind: "screen") => Promise<unknown> };
        };
        const lock = await nav.wakeLock?.request("screen");
        if (!cancelled && lock) wakeLockRef.current = lock;
      } catch {
        /* Wake Lock not supported / denied — fine */
      }
    })();
    return () => {
      cancelled = true;
      const lock = wakeLockRef.current as { release?: () => Promise<void> } | null;
      if (lock?.release) void lock.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [active]);

  // Esc to exit.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onActiveChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onActiveChange]);

  if (!enabled || !active) return null;

  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const date = now.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      role="dialog"
      aria-label="Screensaver — tap to wake"
      onClick={() => onActiveChange(false)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "radial-gradient(ellipse at center, #14152a 0%, #0a0b10 70%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--ink)",
        animation: "saverFadeIn 600ms ease",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          position: "relative",
          width: 160,
          height: 160,
          marginBottom: 36,
          borderRadius: "50%",
          overflow: "hidden",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "0 30px 60px rgba(0, 0, 0, 0.6)",
          animation: "owlBreathe 5s ease-in-out infinite",
        }}
      >
        <Image src="/echo.png" alt="" fill sizes="160px" style={{ objectFit: "cover" }} aria-hidden />
      </div>

      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "clamp(64px, 14vw, 144px)",
          letterSpacing: "-0.04em",
          lineHeight: 1,
          color: "var(--ink)",
          textShadow: "0 4px 30px rgba(138, 107, 255, 0.25)",
        }}
      >
        {time}
      </div>

      <div
        style={{
          marginTop: 16,
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--ink-muted)",
        }}
      >
        {date}
      </div>

      {wakeWordArmed && (
        <div
          style={{
            marginTop: 36,
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "6px 14px",
            borderRadius: 999,
            border: "1px solid rgba(78, 216, 235, 0.25)",
            background: "rgba(78, 216, 235, 0.06)",
            color: "var(--cyan)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: "var(--cyan)",
              boxShadow: "0 0 0 4px rgba(78, 216, 235, 0.18)",
              animation: "saverDot 1.6s ease-in-out infinite",
            }}
          />
          Say &ldquo;Echo&rdquo; to talk
        </div>
      )}

      <div
        style={{
          position: "absolute",
          bottom: 28,
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--ink-faint)",
        }}
      >
        Tap to wake
      </div>

      <style>{`
        @keyframes saverFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes owlBreathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
        @keyframes saverDot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.25); opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
