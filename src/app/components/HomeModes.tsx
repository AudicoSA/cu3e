"use client";

import { useState } from "react";
import Image from "next/image";

const MODES = [
  {
    id: "tutor",
    num: "01",
    name: "Tutor mode",
    tag: "Real homework. Real thinking.",
    headline: "The tutor that refuses to cheat — even when your kid begs.",
    desc: "Upload a homework PDF and Echo reads it, understands it, and never just hands over the answer. It asks the right next question — the way a great human tutor would.",
    bullets: [
      "Reads any worksheet, textbook, or PDF",
      "Socratic by default — never spoon-feeds",
      "Catches and corrects misconceptions in real time",
      "Logs every question so you can see the journey",
    ],
  },
  {
    id: "storybook",
    num: "02",
    name: "Storybook",
    tag: "Author + AI sidekick.",
    headline: "The kid is the author. AI is the sidekick.",
    desc: "Co-write a story with Echo, one paragraph at a time. Every Echo turn comes with a fresh illustration generated on the fly. Kids learn the skill that will actually matter: how to direct a creative AI.",
    bullets: [
      "Original stories generated and illustrated live",
      "Teaches prompting and creative direction",
      "Save and print a real bound storybook",
      "Built-in age-appropriate safety guards",
    ],
  },
  {
    id: "skills",
    num: "03",
    name: "AI skills",
    tag: "How AI actually works.",
    headline: "The stuff school isn't teaching yet — by 2030 it'll be table stakes.",
    desc: "Five short, hands-on lessons about how AI actually thinks: what it sees, how it learns, why it lies, when not to trust it. They learn by poking at it — not by being lectured.",
    bullets: [
      "5 progressive lessons, ~15 min each",
      "Hands-on, not video lectures",
      "Builds the 'AI bullshit detector'",
      "Mapped to the AI4K12 Five Big Ideas framework",
    ],
  },
];

const Arrow = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
);

export default function HomeModes() {
  const [active, setActive] = useState("tutor");
  const mode = MODES.find((m) => m.id === active)!;

  return (
    <section className="modes container" id="modes">
      <div className="modes-head">
        <div>
          <span className="eyebrow">What&apos;s inside</span>
          <h2 className="h-section" style={{ marginTop: 16 }}>
            Three modes, <span className="serif-italic accent">one rule:</span>
            <br />
            never do the thinking for them.
          </h2>
        </div>
        <p>
          Echo is built around a deceptively simple principle. Click any mode to see
          how it works in practice.
        </p>
      </div>

      <div className="mode-tabs">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={"mode-tab " + (m.id === active ? "active" : "")}
            onClick={() => setActive(m.id)}
          >
            <div className="mode-num">Mode {m.num}</div>
            <div className="mode-name">{m.name}</div>
            <div className="mode-tag">{m.tag}</div>
          </button>
        ))}
      </div>

      <div className="mode-panel">
        <div className="mode-panel-left">
          <span className="eyebrow">Mode {mode.num} · {mode.name}</span>
          <div className="mode-tagline">{mode.headline}</div>
          <p className="mode-desc">{mode.desc}</p>
          <ul className="mode-bullets">
            {mode.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <a className="mode-link" href="/study-hub">
            See {mode.name.toLowerCase()} <Arrow />
          </a>
        </div>
        <div className="mode-panel-right">
          {active === "tutor" && <TutorPreview />}
          {active === "storybook" && <StorybookPreview />}
          {active === "skills" && <SkillsPreview />}
        </div>
      </div>
    </section>
  );
}

function TutorPreview() {
  return (
    <div className="chat">
      <div className="chat-header">
        <div className="avatar"><Image src="/echo.png" alt="" fill sizes="36px" style={{ objectFit: "cover" }} /></div>
        <div>
          <div className="chat-name">Echo</div>
          <div className="chat-sub">Patterns_Gr7.pdf · loaded · 4 questions</div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <span className="pill"><span className="dot" /> Live</span>
        </div>
      </div>
      <div className="chat-body">
        <div className="bubble user">
          Just tell me what comes after 2, 5, 8, 11, 14. I have to hand this in tomorrow.
        </div>
        <div className="bubble echo">
          <div className="ico">✦ Echo</div>
          Nope. But I&apos;ll help you find the rule. Look at <strong>2 → 5 → 8</strong>. What&apos;s the same jump each time? Once you spot it, you can do this <em>and</em> something cooler.
        </div>
        <div className="bubble echo">
          <div className="ico">✦ Bonus</div>
          A coffee shop wants a tile floor where each new row adds the same number of tiles your pattern adds. Draw rows 1–4. How many tiles in row 7?
        </div>
      </div>
    </div>
  );
}

function StorybookPreview() {
  return (
    <div className="story-card">
      <div className="story-img">
        <Image src="/marketing/storybook.png" alt="Storybook scene" fill sizes="(min-width: 920px) 40vw, 100vw" style={{ objectFit: "cover" }} />
        <div className="story-img-tag">
          <span className="pill"><span className="dot" /> Just generated</span>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: 16, color: "#fff" }}>
            &quot;The dragon&apos;s chimney&quot;
          </span>
        </div>
      </div>
      <div className="story-body">
        <div className="story-line">
          <span className="author">Maya, 9 · paragraph 3</span>
          The dragon&apos;s wings were too tired. She landed on the chimney and looked at the city below — gold lights flickering like the inside of a kaleidoscope.
        </div>
        <div
          className="story-line"
          style={{
            color: "var(--violet)",
            background: "rgba(78,216,235,0.06)",
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid rgba(78,216,235,0.18)",
          }}
        >
          <span className="author" style={{ color: "var(--violet)" }}>Echo</span>
          What does the dragon do next? Try giving me a few words about her mood — I&apos;ll draw what comes next.
        </div>
      </div>
    </div>
  );
}

function SkillsPreview() {
  const skills = [
    { n: "01", t: "How it sees", d: "Tokens, patterns — how an AI 'reads' words." },
    { n: "02", t: "How it learns", d: "Training data and why it generalizes." },
    { n: "03", t: "Why it lies", d: "Hallucination — why AI confidently makes things up." },
  ];
  return (
    <div className="skills-preview">
      <div className="skills-hero">
        <Image src="/marketing/ai-skills.png" alt="Echo demonstrating AI fallibility" fill sizes="(min-width: 920px) 40vw, 100vw" style={{ objectFit: "cover" }} />
        <div className="skills-hero-tag">
          <span className="pill"><span className="dot" /> Lesson 03 in progress</span>
          <div className="skills-hero-title">Catching AI when it lies</div>
        </div>
      </div>
      <div className="skill-grid">
        {skills.map((s) => (
          <div key={s.n} className="skill-card">
            <div className="skill-num">Lesson {s.n}</div>
            <div className="skill-title">{s.t}</div>
            <div className="skill-desc">{s.d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
