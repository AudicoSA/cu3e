"use client";

import { useEffect, useRef, useState } from "react";

// Audio player for the Sunday-briefing sample on the homepage. Two states:
// idle (big play pill) and playing (compact row with progress + pause).
// Auto-resets when the clip ends so the next visitor sees the same CTA.

const SAMPLE_SRC = "/marketing/weekly-overview-sample.mp3";

export default function WeeklyBriefingPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onMeta = () => setDuration(a.duration);
    const onTime = () => setCurrent(a.currentTime);
    const onEnd = () => {
      setIsPlaying(false);
      setCurrent(0);
    };
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (isPlaying) {
      a.pause();
      setIsPlaying(false);
    } else {
      void a.play();
      setIsPlaying(true);
    }
  };

  const totalSec = Math.round(duration || 53);
  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const pct = duration ? (current / duration) * 100 : 0;

  return (
    <div className="briefing-player" data-playing={isPlaying ? "true" : "false"}>
      <audio ref={audioRef} src={SAMPLE_SRC} preload="metadata" />

      <button
        type="button"
        onClick={toggle}
        aria-label={isPlaying ? "Pause sample" : "Play a sample weekly briefing"}
        className="briefing-play"
      >
        {isPlaying ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M7 4.5v15a1 1 0 0 0 1.5.87l13-7.5a1 1 0 0 0 0-1.74l-13-7.5A1 1 0 0 0 7 4.5z" />
          </svg>
        )}
        <span className="briefing-play-label">
          {isPlaying ? "Pause" : "Play a sample briefing"}
        </span>
        <span className="briefing-play-time">
          {isPlaying || current > 0 ? `${fmt(current)} / ${fmt(totalSec)}` : `${totalSec}s`}
        </span>
      </button>

      {/* Subtle waveform bar; fills as the clip plays */}
      <div className="briefing-wave" aria-hidden>
        <div className="briefing-wave-fill" style={{ width: `${pct}%` }} />
        <div className="briefing-wave-bars">
          {Array.from({ length: 28 }).map((_, i) => (
            <span
              key={i}
              style={{
                animationDelay: `${i * 0.05}s`,
                opacity: isPlaying ? 1 : 0.35,
              }}
            />
          ))}
        </div>
      </div>

      <p className="briefing-caption">
        Real voice. Ava reads a 90-second summary of what your child actually did,
        what tripped them up, and what they cracked.
      </p>

      <style>{`
        .briefing-player {
          margin-top: 28px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .briefing-play {
          display: inline-flex;
          align-items: center;
          gap: 14px;
          padding: 14px 22px;
          background: linear-gradient(135deg, var(--violet) 0%, #5a3fd6 100%);
          color: #fff;
          border: none;
          border-radius: 999px;
          cursor: pointer;
          font-family: var(--font-sans);
          font-size: 15px;
          font-weight: 600;
          box-shadow: 0 14px 32px rgba(138, 107, 255, 0.35);
          transition: transform 140ms ease, box-shadow 200ms ease;
          align-self: flex-start;
        }
        .briefing-play:hover {
          transform: translateY(-1px);
          box-shadow: 0 18px 40px rgba(138, 107, 255, 0.45);
        }
        .briefing-play-label {
          flex: 1;
        }
        .briefing-play-time {
          font-family: var(--font-mono);
          font-size: 11.5px;
          letter-spacing: 0.08em;
          opacity: 0.85;
          padding-left: 12px;
          border-left: 1px solid rgba(255, 255, 255, 0.25);
        }
        .briefing-wave {
          position: relative;
          height: 36px;
          border-radius: 8px;
          background: var(--surface);
          border: 1px solid var(--border);
          overflow: hidden;
        }
        .briefing-wave-fill {
          position: absolute;
          inset: 0 auto 0 0;
          background: linear-gradient(90deg, rgba(138,107,255,0.18), rgba(78,216,235,0.18));
          transition: width 200ms linear;
        }
        .briefing-wave-bars {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 14px;
          gap: 6px;
          pointer-events: none;
        }
        .briefing-wave-bars span {
          flex: 1;
          height: 30%;
          background: linear-gradient(180deg, var(--violet), var(--cyan));
          border-radius: 2px;
          transition: opacity 200ms ease;
          animation: briefWave 1.4s ease-in-out infinite;
          animation-play-state: paused;
        }
        .briefing-player[data-playing="true"] .briefing-wave-bars span {
          animation-play-state: running;
        }
        @keyframes briefWave {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1); }
        }
        .briefing-caption {
          margin: 0;
          font-size: 13px;
          color: var(--ink-muted);
          line-height: 1.55;
          max-width: 460px;
        }
      `}</style>
    </div>
  );
}
