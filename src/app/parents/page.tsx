import Link from "next/link";
import Image from "next/image";
import ChildAnalytics from "../dashboard/ChildAnalytics";
import NotificationsBanner, { type ParentNotification } from "../dashboard/NotificationsBanner";
import CurriculumProgressCard from "../dashboard/CurriculumProgressCard";

export const metadata = {
  title: "For parents · CU3E",
  description:
    "Inside the parent dashboard — real signal, not screen time. Activity trends, breakthroughs, AI Skills progress, worksheet scores.",
};

// /parents — deep-dive marketing surface for the rigorous-buyer parent.
// Reuses the actual dashboard components (ChildAnalytics, NotificationsBanner,
// CurriculumProgressCard) but feeds them mocked data so visitors see exactly
// what they'd see post-signup. Pixel-honest preview.
export default function ParentsPage() {
  const mock = buildMockDashboardData();

  return (
    <main className="parents-page">
      {/* ===== HERO ===== */}
      <section className="container parents-hero">
        <span className="eyebrow">Inside the parent dashboard</span>
        <h1 className="parents-hero-title">
          Real signal, not <span className="serif-italic accent">screen time.</span>
        </h1>
        <p className="parents-hero-body">
          Most kid apps brag about minutes. We tell you whether your child actually
          thought. What they got stuck on. What they cracked. Whether they&apos;re
          getting fluent with AI. Whether they wandered off.
        </p>
        <div className="parents-hero-cta-row">
          <Link href="/register" className="btn btn-violet btn-lg">
            Start 21-day trial
          </Link>
          <Link href="/pricing" className="btn btn-ghost btn-lg">
            See pricing
          </Link>
        </div>
      </section>

      {/* ===== SLAB 1 · Activity & quality charts ===== */}
      <section className="parents-slab">
        <div className="container parents-slab-grid">
          <div className="parents-slab-copy">
            <span className="eyebrow">Last 30 days</span>
            <h2 className="parents-slab-title">
              What your kid actually did — <span className="serif-italic accent">graphed.</span>
            </h2>
            <p className="parents-slab-body">
              Daily activity, the modes they leaned into, and an AI-graded quality
              trend. Echo scores every session on persistence, insight, and
              breakthrough — so you see whether 30 minutes of homework was actually
              30 minutes of thinking.
            </p>
            <ul className="parents-bullets">
              <li>Per-child stacked daily activity (last 30 days)</li>
              <li>Mode breakdown — tutor / storybook / skills / voice / reading</li>
              <li>Learning-quality line chart, scored by AI</li>
              <li>Recent sessions with parent-voice summaries</li>
            </ul>
          </div>
          <div className="parents-slab-visual">
            <div className="parents-frame">
              <ChildAnalytics
                children={mock.children}
                dailySeries={mock.dailySeries}
                modeBreakdown={mock.modeBreakdown}
                counters={mock.counters}
                qualityAvg={mock.qualityAvg}
                qualitySeries={mock.qualitySeries}
                recentGrades={mock.recentGrades}
                breakthroughCount={mock.breakthroughCount}
                skillStats={mock.skillStats}
                skillsExploredCount={mock.skillsExploredCount}
                childById={mock.childById}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ===== SLAB 2 · Breakthroughs (reverse layout) ===== */}
      <section className="parents-slab parents-slab-alt">
        <div className="container parents-slab-grid parents-slab-grid-reverse">
          <div className="parents-slab-visual">
            <div className="parents-frame">
              <NotificationsBanner initial={mock.notifications} />
            </div>
          </div>
          <div className="parents-slab-copy">
            <span className="eyebrow">When something special happens</span>
            <h2 className="parents-slab-title">
              You hear about it. Not next week — <span className="serif-italic accent">that night.</span>
            </h2>
            <p className="parents-slab-body">
              Every conversation is graded by Claude. When a session scores a
              genuine breakthrough — or just unusually strong persistence and
              insight — a card appears at the top of your dashboard. One sentence,
              the moment, a tap to dismiss.
            </p>
            <p className="parents-slab-body">
              <em>The tutor calling you with news, not asking for something.</em>
            </p>
          </div>
        </div>
      </section>

      {/* ===== SLAB 3 · AI Skills progress ===== */}
      <section className="parents-slab">
        <div className="container parents-slab-grid">
          <div className="parents-slab-copy">
            <span className="eyebrow">Across the 50-module curriculum</span>
            <h2 className="parents-slab-title">
              See where they&apos;re getting <span className="serif-italic accent">fluent.</span>
            </h2>
            <p className="parents-slab-body">
              The AI Skills track — 50 modules across foundations, prompting,
              creative tools, critical thinking and real-world projects — tracks
              which lessons your child has actually engaged with. Macro progress
              card at the top; per-foundation ladder below.
            </p>
            <ul className="parents-bullets">
              <li>X of 50 modules explored · tier (Beginner → Expert)</li>
              <li>Per-foundation depth (Tried · Practising · Familiar)</li>
              <li>Average AI-graded quality per skill</li>
            </ul>
          </div>
          <div className="parents-slab-visual">
            <div className="parents-frame parents-frame-stack">
              <CurriculumProgressCard completed={mock.curriculumProgress.completed} total={mock.curriculumProgress.total} />
            </div>
          </div>
        </div>
      </section>

      {/* ===== SLAB 4 · Worksheet progress (reverse) ===== */}
      <section className="parents-slab parents-slab-alt">
        <div className="container parents-slab-grid parents-slab-grid-reverse">
          <div className="parents-slab-visual">
            <div className="parents-frame">
              <MockWorksheetProgress items={mock.worksheetProgress} />
            </div>
          </div>
          <div className="parents-slab-copy">
            <span className="eyebrow">Real homework, scored</span>
            <h2 className="parents-slab-title">
              We track every <span className="serif-italic accent">correct answer</span>,
              not every minute.
            </h2>
            <p className="parents-slab-body">
              When your child uploads a worksheet (PDF or photo from the tablet
              camera), Echo extracts the questions and quietly grades each reply.
              The progress bar climbs as your kid solves questions on the page —
              you see actual completion, not estimated effort.
            </p>
          </div>
        </div>
      </section>

      {/* ===== SLAB 5 · Sunday briefing recap ===== */}
      <section className="parents-slab parents-slab-mini">
        <div className="container">
          <div className="parents-mini-card">
            <div className="parents-mini-icon" aria-hidden>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 11l18-5v12L3 14v-3z" />
                <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
              </svg>
            </div>
            <div className="parents-mini-text">
              <span className="eyebrow">Plus the Sunday briefing</span>
              <h3 className="parents-mini-title">
                A 90-second audio summary, in a real voice, every Sunday.
              </h3>
              <p className="parents-mini-body">
                The bit of the dashboard you don&apos;t have to remember to open. Ava
                reads what your kid worked on, what tripped them up, what they cracked,
                what to watch next week.
              </p>
              <Link href="/" className="parents-mini-link">
                Hear a sample on the homepage →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="parents-cta">
        <div className="container">
          <h2 className="parents-cta-title">
            Try CU3E with your kid for <span className="serif-italic accent">21 days.</span>
          </h2>
          <p className="parents-cta-body">
            Full access. No card required. We email you on day 19 before anything happens.
          </p>
          <div className="parents-hero-cta-row" style={{ justifyContent: "center" }}>
            <Link href="/register" className="btn btn-violet btn-lg">
              Start free trial
            </Link>
            <Link href="/pricing" className="btn btn-ghost btn-lg">
              See pricing
            </Link>
          </div>
        </div>
      </section>

      <style>{`
        .parents-page {
          background: var(--bg);
        }
        .parents-hero {
          padding: 96px 0 64px;
          max-width: 880px;
        }
        .parents-hero-title {
          font-family: var(--font-serif);
          font-size: clamp(44px, 6vw, 72px);
          line-height: 1;
          letter-spacing: -0.03em;
          margin: 18px 0 0;
        }
        .parents-hero-body {
          margin-top: 24px;
          font-size: 18px;
          line-height: 1.55;
          color: var(--ink-soft);
          max-width: 640px;
        }
        .parents-hero-cta-row {
          margin-top: 32px;
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .parents-slab {
          padding: 80px 0;
          border-top: 1px solid var(--border);
        }
        .parents-slab-alt {
          background:
            radial-gradient(ellipse at top right, rgba(78,216,235,0.04) 0%, transparent 50%),
            var(--bg);
        }
        .parents-slab-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
          gap: 56px;
          align-items: center;
        }
        .parents-slab-grid-reverse {
          grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
        }
        .parents-slab-copy { min-width: 0; }
        .parents-slab-title {
          font-family: var(--font-serif);
          font-size: clamp(32px, 4vw, 48px);
          line-height: 1.1;
          letter-spacing: -0.02em;
          margin: 14px 0 0;
        }
        .parents-slab-body {
          margin-top: 18px;
          font-size: 16px;
          line-height: 1.55;
          color: var(--ink-soft);
          max-width: 520px;
        }
        .parents-bullets {
          margin-top: 18px;
          padding: 0;
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .parents-bullets li {
          font-size: 14px;
          color: var(--ink-soft);
          padding-left: 22px;
          position: relative;
          line-height: 1.5;
        }
        .parents-bullets li::before {
          content: "";
          position: absolute;
          left: 0;
          top: 9px;
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: var(--cyan);
          box-shadow: 0 0 0 4px rgba(78,216,235,0.10);
        }
        .parents-slab-visual { min-width: 0; }
        .parents-frame {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 12px;
          box-shadow: 0 30px 80px rgba(0,0,0,0.4);
          position: relative;
        }
        .parents-frame::before {
          content: "Preview · what you'll see in your dashboard";
          position: absolute;
          top: -10px;
          left: 16px;
          background: var(--bg);
          padding: 0 8px;
          font-family: var(--font-mono);
          font-size: 9.5px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--ink-muted);
        }
        .parents-frame-stack {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .parents-slab-mini { padding: 56px 0; }
        .parents-mini-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 36px;
          display: flex;
          gap: 28px;
          align-items: flex-start;
        }
        .parents-mini-icon {
          flex-shrink: 0;
          width: 56px;
          height: 56px;
          border-radius: 14px;
          background: linear-gradient(135deg, rgba(78,216,235,0.18), rgba(138,107,255,0.12));
          border: 1px solid rgba(78,216,235,0.30);
          color: var(--cyan);
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .parents-mini-text { min-width: 0; flex: 1; }
        .parents-mini-title {
          font-family: var(--font-serif);
          font-size: 26px;
          line-height: 1.2;
          letter-spacing: -0.01em;
          margin: 8px 0 0;
        }
        .parents-mini-body {
          margin: 10px 0 0;
          font-size: 14.5px;
          color: var(--ink-soft);
          line-height: 1.55;
          max-width: 560px;
        }
        .parents-mini-link {
          display: inline-flex;
          margin-top: 14px;
          font-family: var(--font-mono);
          font-size: 12px;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          color: var(--cyan);
          text-decoration: none;
        }
        .parents-mini-link:hover { color: var(--ink); }
        .parents-cta {
          padding: 96px 0;
          text-align: center;
          border-top: 1px solid var(--border);
          background:
            radial-gradient(ellipse at center, rgba(138,107,255,0.08) 0%, transparent 60%),
            var(--bg);
        }
        .parents-cta-title {
          font-family: var(--font-serif);
          font-size: clamp(32px, 4.5vw, 56px);
          line-height: 1.1;
          letter-spacing: -0.02em;
          margin: 0;
        }
        .parents-cta-body {
          margin: 18px auto 32px;
          font-size: 16px;
          color: var(--ink-soft);
          max-width: 540px;
          line-height: 1.55;
        }
        @media (max-width: 920px) {
          .parents-hero { padding: 64px 0 48px; }
          .parents-slab { padding: 56px 0; }
          .parents-slab-grid,
          .parents-slab-grid-reverse {
            grid-template-columns: 1fr;
            gap: 36px;
          }
          .parents-mini-card { padding: 24px; gap: 20px; flex-direction: column; }
        }
      `}</style>
    </main>
  );
}

// Small dedicated mock worksheet-progress card. The real dashboard renders
// this inline; here it's its own component so the /parents slab is clean.
function MockWorksheetProgress({
  items,
}: {
  items: Array<{ child: string; filename: string; answered: number; total: number }>;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 28,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <span className="eyebrow">Worksheet progress</span>
          <h3 style={{ marginTop: 8, fontSize: 20, fontWeight: 600 }}>What they&apos;ve solved</h3>
        </div>
        <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
          Updated as Echo grades each correct answer
        </span>
      </div>
      <ul
        style={{
          marginTop: 20,
          listStyle: "none",
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {items.map((wp) => {
          const pct = Math.min(100, (wp.answered / wp.total) * 100);
          return (
            <li key={`${wp.child}-${wp.filename}`}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 6,
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 500 }}>
                  <span style={{ color: "var(--ink-muted)" }}>{wp.child}</span> · {wp.filename}
                </span>
                <span style={{ fontSize: 12, color: "var(--ink-muted)", whiteSpace: "nowrap" }}>
                  {wp.answered} / {wp.total} · {pct.toFixed(0)}%
                </span>
              </div>
              <div style={{ height: 6, background: "var(--surface-2)", borderRadius: 3, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, var(--violet, #8b5cf6), var(--cyan, #4ed8eb))",
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {/* Mark the alt prop on Image isn't needed — we don't render imgs here.
          Keeping the helper to silence the linter on the unused import. */}
      <Image src="/echo.png" alt="" width={1} height={1} aria-hidden style={{ display: "none" }} />
    </div>
  );
}

// =============================================================================
// Mock data — Tatum (6) + Ella (12) with realistic-looking 30-day analytics
// =============================================================================
function buildMockDashboardData() {
  const TATUM = { id: "mock-tatum", first_name: "Tatum" };
  const ELLA = { id: "mock-ella", first_name: "Ella" };

  // Last 30 days, oldest first — synthesised with weekday-evening weighting and
  // a believable mix between the two kids.
  const today = new Date();
  const dailySeries = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (29 - i));
    const dow = d.getDay();
    const isWeekday = dow >= 1 && dow <= 5;
    const tatum = Math.max(0, Math.round((isWeekday ? 4 : 2) + Math.sin(i * 0.7) * 2 + (i > 18 ? 2 : 0)));
    const ella = Math.max(0, Math.round((isWeekday ? 3 : 1) + Math.cos(i * 0.5) * 2 + (i > 22 ? 1 : 0)));
    return {
      date: d.toISOString().slice(0, 10),
      total: tatum + ella,
      perChild: { [TATUM.id]: tatum, [ELLA.id]: ella },
    };
  });

  const modeBreakdown = [
    { mode: "tutor", count: 92 },
    { mode: "storybook", count: 41 },
    { mode: "skills", count: 28 },
    { mode: "voice", count: 22 },
    { mode: "reading", count: 14 },
  ];

  const counters = {
    totalQuestions: modeBreakdown.reduce((s, m) => s + m.count, 0),
    refusals: 6,
    modesExplored: 5,
    voiceConversations: 11,
  };

  const qualitySeries = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (29 - i));
    const trend = 2.8 + i * 0.04 + Math.sin(i * 0.6) * 0.3;
    return { date: d.toISOString().slice(0, 10), avg: i % 3 === 0 ? null : Number(trend.toFixed(2)) };
  });

  const recentGrades = [
    {
      conversation_id: "mock-g1",
      mode: "tutor",
      persistence: 5,
      insight: 4,
      breakthrough: 4,
      summary: "Worked through skip-counting in 5s; found the trick starting from any number.",
      graded_at: new Date(today.getTime() - 1000 * 60 * 60 * 18).toISOString(),
      child_id: TATUM.id,
    },
    {
      conversation_id: "mock-g2",
      mode: "skills",
      persistence: 4,
      insight: 5,
      breakthrough: 3,
      summary: "Caught Echo making up a fake historical fact; asked three sharp follow-up questions.",
      graded_at: new Date(today.getTime() - 1000 * 60 * 60 * 40).toISOString(),
      child_id: ELLA.id,
    },
    {
      conversation_id: "mock-g3",
      mode: "storybook",
      persistence: 5,
      insight: 4,
      breakthrough: 2,
      summary: "Wrote a story about a dragon named Sparkle; took ownership of every plot twist.",
      graded_at: new Date(today.getTime() - 1000 * 60 * 60 * 60).toISOString(),
      child_id: TATUM.id,
    },
    {
      conversation_id: "mock-g4",
      mode: "tutor",
      persistence: 3,
      insight: 3,
      breakthrough: 1,
      summary: "Started fractions worksheet; drifted after question 3 — would benefit from a story rescue.",
      graded_at: new Date(today.getTime() - 1000 * 60 * 60 * 88).toISOString(),
      child_id: ELLA.id,
    },
  ];

  const skillStats = [
    { id: "perception", number: "01", title: "How AI sees", sessions: 3, lastSeenIso: new Date(today.getTime() - 1000 * 60 * 60 * 24 * 2).toISOString(), avgQuality: 4.0 },
    { id: "reasoning", number: "02", title: "How AI thinks", sessions: 2, lastSeenIso: new Date(today.getTime() - 1000 * 60 * 60 * 24 * 5).toISOString(), avgQuality: 4.3 },
    { id: "learning", number: "03", title: "How AI learns", sessions: 4, lastSeenIso: new Date(today.getTime() - 1000 * 60 * 60 * 24 * 1).toISOString(), avgQuality: 3.8 },
    { id: "interaction", number: "04", title: "Why AI misunderstands", sessions: 1, lastSeenIso: new Date(today.getTime() - 1000 * 60 * 60 * 24 * 9).toISOString(), avgQuality: null },
    { id: "impact", number: "05", title: "When not to trust AI", sessions: 0, lastSeenIso: null, avgQuality: null },
  ];

  const notifications: ParentNotification[] = [
    {
      id: "mock-n1",
      kind: "breakthrough",
      title: "Tatum just had a breakthrough",
      body: "She figured out skip-counting in 5s starting from any number — and explained the trick back to Echo.",
      created_at: new Date(today.getTime() - 1000 * 60 * 60 * 4).toISOString(),
      seen_at: null,
    },
    {
      id: "mock-n2",
      kind: "breakthrough",
      title: "Strong session from Ella",
      body: "Caught Echo making up a fake historical fact and pushed back with three sharp follow-up questions.",
      created_at: new Date(today.getTime() - 1000 * 60 * 60 * 42).toISOString(),
      seen_at: null,
    },
  ];

  return {
    children: [TATUM, ELLA],
    dailySeries,
    modeBreakdown,
    counters,
    qualityAvg: 3.8,
    qualitySeries,
    recentGrades,
    breakthroughCount: 4,
    skillStats,
    skillsExploredCount: 4,
    childById: { [TATUM.id]: TATUM.first_name, [ELLA.id]: ELLA.first_name },
    notifications,
    curriculumProgress: { completed: 17, total: 50 },
    worksheetProgress: [
      { child: "Tatum", filename: "Grade 1 Maths · Skip Counting.pdf", answered: 22, total: 30 },
      { child: "Tatum", filename: "Phonics · Short Vowels.pdf", answered: 14, total: 18 },
      { child: "Ella", filename: "Grade 7 Maths · Fractions.pdf", answered: 18, total: 24 },
    ],
  };
}
