import Link from "next/link";
import { tierForProgress } from "@/lib/skills";

// Macro AI-Skills progress card. "X of 50 explored — Intermediate" with a
// thin gradient progress bar. Used on the parent dashboard and on the
// /parents marketing deep-dive page (where it's mocked with fake numbers
// to show parents what they'd see post-signup).
export default function CurriculumProgressCard({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  const progress = tierForProgress(completed);
  const pct = (completed / total) * 100;
  return (
    <Link
      href="/skills"
      style={{
        textDecoration: "none",
        color: "inherit",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 24,
        display: "block",
        transition: "border-color 180ms ease",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="eyebrow">AI Skills journey</span>
          <div
            style={{
              marginTop: 8,
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 32,
                letterSpacing: "-0.02em",
                color: "var(--violet)",
                lineHeight: 1,
              }}
            >
              {completed}
              <span style={{ fontSize: 16, color: "var(--ink-muted)", marginLeft: 4 }}>
                of {total}
              </span>
            </span>
            <span
              className="pill"
              style={{
                background: "rgba(138,107,255,0.12)",
                borderColor: "rgba(138,107,255,0.35)",
                fontSize: 11,
              }}
            >
              {progress.label}
            </span>
          </div>
          <p
            style={{
              marginTop: 8,
              fontSize: 13,
              color: "var(--ink-muted)",
              maxWidth: 540,
              lineHeight: 1.5,
            }}
          >
            {progress.blurb}
          </p>
        </div>
        <span
          style={{
            fontSize: 13,
            color: "var(--violet)",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          Open AI Skills
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </span>
      </div>
      <div
        style={{
          marginTop: 16,
          height: 6,
          background: "var(--surface-2)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.max(2, pct)}%`,
            height: "100%",
            background: "linear-gradient(90deg, var(--violet, #8a6bff), var(--cyan, #4ed8eb))",
            transition: "width 600ms ease",
          }}
        />
      </div>
    </Link>
  );
}
