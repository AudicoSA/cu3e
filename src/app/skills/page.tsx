import Link from "next/link";
import { SKILL_LESSONS, type SkillLesson } from "@/lib/skills";

export default function SkillsPage() {
  return (
    <section className="modes container" style={{ paddingTop: 80 }}>
      <div className="meet-head" style={{ textAlign: "left", marginBottom: 56, maxWidth: 720 }}>
        <span className="eyebrow">AI Skills</span>
        <h1 className="h-section" style={{ marginTop: 16 }}>
          The stuff school <span className="serif-italic accent">isn&apos;t teaching</span> yet.
        </h1>
        <p
          style={{
            marginTop: 20,
            color: "var(--ink-soft)",
            fontSize: 17,
            lineHeight: 1.6,
          }}
        >
          Five short, hands-on conversations with Echo about how AI actually works. Not lectures —
          your kid learns by poking at it themselves. Guessing, breaking it, spotting mistakes.
          Designed to be done in any order, any time.
        </p>
      </div>

      <div className="skill-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        {SKILL_LESSONS.map((idea) => (
          <IdeaCard key={idea.id} idea={idea} />
        ))}
      </div>

      <p
        style={{
          marginTop: 56,
          fontSize: 14,
          color: "var(--ink-muted)",
          maxWidth: 680,
        }}
      >
        These lessons adapt to your child&apos;s age. They&apos;ll play differently for a 6-year-old
        than for a 12-year-old — same idea, different game.
      </p>
    </section>
  );
}

function IdeaCard({ idea }: { idea: SkillLesson }) {
  const href = `/study-hub?mode=skills&prompt=${encodeURIComponent(idea.prompt)}`;
  return (
    <Link
      href={href}
      className="skill-card"
      style={{
        background: "var(--surface)",
        textDecoration: "none",
        padding: 28,
        gap: 14,
        cursor: "pointer",
        transition: "border-color 180ms ease, background 180ms ease, transform 180ms ease",
      }}
    >
      <div className="skill-num">Lesson {idea.number}</div>
      <div className="skill-title" style={{ fontSize: 26 }}>{idea.title}</div>
      <p
        style={{
          fontSize: 14,
          color: "var(--ink-soft)",
          lineHeight: 1.55,
          margin: "8px 0 0",
          flex: 1,
        }}
      >
        {idea.pitch}
      </p>
      <div
        style={{
          marginTop: 16,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: "var(--violet)",
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        Start lesson
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}
