import Image from "next/image";
import HomeModes from "./components/HomeModes";
import HomeFAQ from "./components/HomeFAQ";

const Check = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);
const Arrow = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
);
const Play = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4" /></svg>
);

export default function Home() {
  return (
    <>
      {/* ---------- HERO ---------- */}
      <section className="hero">
        <div className="hero-grid" />
        <div className="container hero-content">
          <div>
            <span className="hero-tag">
              <span className="tag-chip">New</span>
              Built with parents · For ages 6–14
            </span>
            <h1 className="h-hero">
              The AI tutor that <span className="serif-italic accent">refuses</span>{" "}
              to do your child&apos;s homework{" "}
              <span className="underline">— and quietly</span>{" "}
              raises them for the{" "}
              <span className="serif-italic">world they&apos;re growing into.</span>
            </h1>
            <p className="hero-sub">
              Echo helps your kid work through real homework, Socratically, no shortcuts.
              In the background, every conversation builds the AI-fluency that no school is
              teaching yet.
            </p>
            <div className="hero-cta-row">
              <a href="/register" className="btn btn-violet btn-lg">
                Start 14-day trial <Arrow />
              </a>
              <a href="#demo" className="btn btn-ghost btn-lg">
                <Play /> Watch Echo in action
              </a>
            </div>
            <div className="hero-meta">
              <div className="hero-meta-item"><Check /> No card required</div>
              <div className="hero-meta-item"><Check /> Cancel anytime</div>
              <div className="hero-meta-item"><Check /> Aligned with CAPS · Common Core · GCSE · IB</div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="next-image-wrap">
              <Image
                src="/marketing/hero-echo.png"
                alt="Echo, the CU3E owl"
                fill
                sizes="(min-width: 980px) 50vw, 100vw"
                priority
                style={{ objectFit: "cover" }}
              />
            </div>
            <div className="hero-overlay-card top-left">
              <span className="live-indicator" />
              <div>
                <div className="echo-badge-name">Meet Echo · OWL-T7</div>
                <div className="echo-badge-status">Your child&apos;s AI tutor</div>
              </div>
            </div>
            <div className="hero-overlay-card bottom-right">
              <div className="echo-badge-name" style={{ marginBottom: 6 }}>Curriculum loaded</div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, lineHeight: 1.1, marginBottom: 8 }}>
                Patterns &amp; Algebra <span style={{ color: "var(--ink-muted)" }}>Gr 7</span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["uploaded", "parsed", "tutoring"].map((s) => (
                  <span key={s} style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 999, background: "var(--surface-3)", color: "var(--ink-soft)" }}>{s}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- TRUST STRIP ---------- */}
      <section className="trust">
        <div className="container trust-row">
          <span className="trust-label">Curriculum-aligned</span>
          <div className="trust-marks">
            <span className="trust-mark">CAPS · South Africa</span>
            <span className="trust-mark">Common Core · US</span>
            <span className="trust-mark">GCSE · UK</span>
            <span className="trust-mark">IB</span>
            <span className="trust-mark">Australian Curriculum</span>
          </div>
        </div>
      </section>

      {/* ---------- DUAL WORLD ---------- */}
      <section className="dual">
        <div className="container-tight">
          <span className="eyebrow">Why CU3E exists</span>
          <h2 className="h-section">
            School is teaching for the{" "}
            <span className="serif-italic" style={{ color: "var(--ink-muted)" }}>world that was.</span>
            <br />
            We&apos;re teaching for the <span className="serif-italic accent">one that&apos;s coming.</span>
          </h2>
          <p className="dual-sub">
            Your child still has homework due tomorrow — we get that. So Echo helps them through
            it, no shortcuts. But quietly, every conversation also builds the skills no school
            is teaching yet: how AI thinks, where it fails, how to direct it, how to spot it lying.
          </p>
        </div>
        <div className="dual-image">
          <div className="dual-image-frame">
            <Image
              src="/marketing/dual-world.png"
              alt="Echo bridging classroom and AI lab"
              fill
              sizes="(min-width: 1320px) 1320px, 100vw"
              style={{ objectFit: "cover" }}
            />
          </div>
          <div className="dual-image-overlay">
            <div className="dual-tag">
              <span className="dot" />
              <span>Echo standing between two worlds — yours and theirs</span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- MODES (client island) ---------- */}
      <HomeModes />

      {/* ---------- MEET ECHO ---------- */}
      <section className="meet-echo">
        <div className="container">
          <div className="meet-head">
            <span className="eyebrow">Say hi to Echo</span>
            <h2 className="h-section" style={{ marginTop: 16 }}>
              A mascot kids actually <span className="serif-italic accent">like.</span>
              <br />
              <span
                className="muted"
                style={{ fontSize: "0.6em", fontFamily: "var(--font-sans)", fontWeight: 400, letterSpacing: 0 }}
              >
                (That alone is half the battle.)
              </span>
            </h2>
          </div>
          <div className="meet-grid">
            <div className="meet-card meet-card-tall">
              <Image src="/echo.png" alt="Echo portrait" fill sizes="(min-width: 920px) 33vw, 100vw" style={{ objectFit: "cover" }} />
              <div className="meet-card-tag">
                <div className="mono" style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--cyan)" }}>
                  OWL-T7 · v2.6
                </div>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 28, lineHeight: 1.1, marginTop: 4, color: "#fff" }}>
                  This is Echo.
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 6 }}>
                  Patient. Curious. Allergic to shortcuts.
                </div>
              </div>
            </div>
            <div className="meet-stack">
              <div className="meet-card">
                <Image src="/marketing/hero-echo.png" alt="Echo reading homework" fill sizes="(min-width: 920px) 22vw, 50vw" style={{ objectFit: "cover" }} />
                <div className="meet-card-label">Reads any worksheet</div>
              </div>
              <div className="meet-card">
                <Image src="/marketing/ai-skills.png" alt="Echo demonstrating AI" fill sizes="(min-width: 920px) 22vw, 50vw" style={{ objectFit: "cover" }} />
                <div className="meet-card-label">Teaches AI literacy</div>
              </div>
            </div>
            <div className="meet-stack">
              <div className="meet-card">
                <Image src="/marketing/storybook.png" alt="Storybook scene" fill sizes="(min-width: 920px) 22vw, 50vw" style={{ objectFit: "cover" }} />
                <div className="meet-card-label">Co-writes stories</div>
              </div>
              <div className="meet-card meet-card-note">
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, lineHeight: 1.2, letterSpacing: "-0.01em" }}>
                  &quot;Echo never makes me feel stupid. It just asks the next question.&quot;
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-muted)",
                    letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 12,
                  }}
                >
                  — Noah, 8
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- HOW IT WORKS ---------- */}
      <section className="how">
        <div className="container">
          <div className="how-head">
            <span className="eyebrow">Two minutes to set up</span>
            <h2 className="h-section" style={{ marginTop: 16 }}>
              From homework dread to <span className="serif-italic accent">actual learning</span>, fast.
            </h2>
          </div>
          <div className="steps">
            {[
              { n: "1", t: "Add your child", d: "Quick profile: age, grade, school curriculum. 90 seconds." },
              { n: "2", t: "Upload one homework", d: "Echo reads it, understands the topic, and gets ready to guide — not to answer." },
              { n: "3", t: "Watch the difference", d: "Your kid actually thinks. You get a parent report after every session." },
            ].map((s) => (
              <div className="step" key={s.n}>
                <div className="step-num">{s.n}</div>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- OUTCOMES ---------- */}
      <section className="outcomes" id="outcomes">
        <div className="container outcomes-grid">
          <div>
            <span className="eyebrow">What your child gains</span>
            <h2 className="h-section">
              The kind of <span className="serif-italic">thinking</span>
              <br />
              <span className="serif-italic accent">work won&apos;t replace.</span>
            </h2>
            <p className="lead">
              We&apos;re not pretending to have a longitudinal study yet. What we are
              doing is tracking exactly these signals from day one — so you can
              see, in your own dashboard, the shifts that matter.
            </p>
            <div className="outcomes-skills">
              <div className="skill-row"><span className="label">Critical reasoning</span><span className="gain">Tracking <Arrow size={11} /></span></div>
              <div className="skill-row"><span className="label">Self-directed problem solving</span><span className="gain">Tracking <Arrow size={11} /></span></div>
              <div className="skill-row"><span className="label">Confidence with unfamiliar problems</span><span className="gain">Tracking <Arrow size={11} /></span></div>
              <div className="skill-row"><span className="label">AI-tool fluency</span><span className="gain">Tracking <Arrow size={11} /></span></div>
            </div>
          </div>
          <div className="outcomes-stats">
            <div className="stat-card">
              <div className="stat-num">0</div>
              <div className="stat-label">Times Echo has given a kid the answer outright. By design.</div>
              <div className="stat-meta">It&apos;s literally how it&apos;s built.</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">3</div>
              <div className="stat-label">Distinct modes: Tutor (homework), Storybook (create), AI Skills (learn about AI itself).</div>
              <div className="stat-meta">Plus voice in all three</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">5</div>
              <div className="stat-label">Hands-on AI literacy lessons — how AI sees, thinks, learns, fails, and when not to trust it.</div>
              <div className="stat-meta">Mapped to AI4K12</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">100<span className="unit">%</span></div>
              <div className="stat-label">Visible to the parent. Every prompt logged, every refusal flagged, every breakthrough timestamped.</div>
              <div className="stat-meta">No black box</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- WHY THIS EXISTS ---------- */}
      <section className="testi">
        <div className="container">
          <div className="testi-head">
            <div>
              <span className="eyebrow">Why this exists</span>
              <h2>
                I have two daughters.
                <br />
                Their school <span className="serif-italic">is good.</span>
                <br />
                It&apos;s also teaching for the <span className="serif-italic">wrong era.</span>
              </h2>
            </div>
          </div>

          <div className="testi-grid">
            <div className="testi-card featured">
              <span className="quote-mark">&ldquo;</span>
              <div className="quote">
                I watch my 12-year-old reach for ChatGPT before she reaches for her own brain. I watch my 6-year-old grow up assuming AI is just there, like electricity. Neither of them is being taught how it actually works — how to direct it, when to push back, when to trust it. So I&apos;m building the thing I wish existed.
              </div>
              <div className="author">
                <div className="author-avatar" style={{ background: "#3a3530", color: "var(--cream)" }}>K</div>
                <div>
                  <div className="author-name">Kenny</div>
                  <div className="author-meta">Dad of two · Ballito, South Africa</div>
                </div>
              </div>
            </div>
            <div className="testi-card compact">
              <span className="quote-mark">&ldquo;</span>
              <div className="quote">
                Echo refuses to do the homework. That&apos;s not a bug — it&apos;s the whole point. The kid does the thinking; the AI asks the next good question.
              </div>
              <div className="author">
                <div>
                  <div className="author-name">The rule that doesn&apos;t bend</div>
                  <div className="author-meta">Architectural, not just policy</div>
                </div>
              </div>
            </div>
            <div className="testi-card compact">
              <span className="quote-mark">&ldquo;</span>
              <div className="quote">
                The parents we build for are the ones who notice their kid is being shaped by tools nobody&apos;s explained to them — and want to shape the shaping.
              </div>
              <div className="author">
                <div>
                  <div className="author-name">Who CU3E is for</div>
                  <div className="author-meta">If that&apos;s you — try it</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- SAFETY ---------- */}
      <section className="safety" id="parents">
        <div className="container safety-grid">
          <div>
            <span className="eyebrow">Built for parents to trust</span>
            <h2 className="h-section" style={{ marginTop: 16 }}>
              You see <span className="serif-italic accent">everything.</span>
              <br />
              Echo answers to <span className="serif-italic">you,</span> not to your kid.
            </h2>
            <p className="lead" style={{ marginTop: 20, color: "var(--ink-soft)", fontSize: 16, lineHeight: 1.6 }}>
              Every conversation, every refusal, every breakthrough — visible from the parent
              dashboard. Set time limits, lock subjects, flag content. Your kid never sees it.
            </p>
            <div className="safety-feats">
              <SafetyFeat title="Full session transcripts" desc="Read every word Echo and your child exchanged.">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /></svg>
              </SafetyFeat>
              <SafetyFeat title="Designed for POPIA / GDPR" desc="Built privacy-first from day one. Your child's conversations never train public AI models.">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              </SafetyFeat>
              <SafetyFeat title="Time-boxed by default" desc="25-minute soft caps. Set hard limits in one tap.">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              </SafetyFeat>
              <SafetyFeat title="Age-appropriate by design" desc="Voice and language adapt to the child. Echo never roams the open internet.">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              </SafetyFeat>
            </div>
          </div>

          <div className="dashboard-mock" style={{ position: "relative" }}>
            <span
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                zIndex: 2,
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--ink-muted)",
                background: "rgba(7,8,13,0.78)",
                border: "1px solid var(--border-strong)",
                borderRadius: 999,
                padding: "3px 10px",
              }}
            >
              Example
            </span>
            <div className="dash-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="brand-mark"><Image src="/echo.png" alt="" fill sizes="30px" style={{ objectFit: "cover" }} /></div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Parent dashboard</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--ink-muted)", letterSpacing: "0.08em" }}>
                    ZARA · 11 · GRADE 6
                  </div>
                </div>
              </div>
              <div className="dash-tabs">
                <span className="dash-tab active">This week</span>
                <span className="dash-tab">Month</span>
                <span className="dash-tab">All time</span>
              </div>
            </div>
            <div className="dash-body">
              <div className="dash-stat-row">
                <div className="dash-stat"><div className="v">14</div><div className="l">Sessions</div></div>
                <div className="dash-stat"><div className="v">3h 42m</div><div className="l">Thinking time</div></div>
                <div className="dash-stat"><div className="v">11</div><div className="l">Breakthroughs</div></div>
              </div>
              <div className="dash-list">
                <DashListItem title="Patterns & Algebra · worksheet 3" sub="Echo refused 4 direct-answer requests. She solved 3 on her own." meta="today" />
                <DashListItem title={`Storybook · "The dragon's chimney"`} sub="14 paragraphs co-written. 6 illustrations generated." meta="yesterday" />
                <DashListItem title={`AI Skills · Lesson 03 "Why it lies"`} sub="Completed. Caught 3 of 3 fake AI claims." meta="Tue" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- PRICING ---------- */}
      <section className="pricing" id="pricing">
        <div className="container">
          <div className="pricing-head">
            <span className="eyebrow">Honest pricing</span>
            <h2 className="h-section" style={{ marginTop: 16 }}>
              Less than <span className="serif-italic accent">one tutoring session</span>
              <br />
              a month. Cancel any time.
            </h2>
          </div>
          <div className="plan-grid">
            <div className="plan">
              <h3>Trial</h3>
              <div className="plan-price">
                <span className="amount">R0</span>
                <span className="period">/ 14 days</span>
              </div>
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                Full access. No card required. We email you on day 12 before anything happens.
              </p>
              <ul>
                <li><Check /> All 3 modes</li>
                <li><Check /> 1 child profile</li>
                <li><Check /> Parent dashboard</li>
                <li className="muted">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/></svg>
                  Multi-child sharing
                </li>
              </ul>
              <a href="/register" className="btn btn-ghost">Start trial <Arrow size={12} /></a>
            </div>

            <div className="plan feature">
              <span className="plan-tag">Introductory</span>
              <h3>Per child</h3>
              <div className="plan-price" style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                <span
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 22,
                    letterSpacing: "-0.02em",
                    color: "var(--ink-muted)",
                    textDecoration: "line-through",
                    textDecorationColor: "rgba(255,255,255,0.4)",
                    textDecorationThickness: "2px",
                    lineHeight: 1,
                  }}
                >
                  R799
                </span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span className="amount">R499</span>
                  <span className="period">/ child / month</span>
                </div>
              </div>
              <p
                className="muted"
                style={{
                  fontSize: 12,
                  margin: 0,
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--cyan)",
                }}
              >
                Early-access pricing · launch soon
              </p>
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                Each child gets their own Echo — adapted to their age, curriculum, and pace.
              </p>
              <ul>
                <li><Check /> One personalised Echo per child</li>
                <li><Check /> Unlimited tutor + storybook + AI skills</li>
                <li><Check /> Voice conversations (fair-use cap)</li>
                <li><Check /> Weekly parent audio overview</li>
                <li><Check /> Curriculum match (CAPS / CC / GCSE / IB)</li>
              </ul>
              <a href="/register" className="btn btn-violet">Start free trial <Arrow size={12} /></a>
            </div>

            <div className="plan">
              <h3>Schools</h3>
              <div className="plan-price">
                <span className="amount">Talk to us</span>
              </div>
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                Classroom licenses, teacher dashboards, and curriculum integration.
              </p>
              <ul>
                <li><Check /> Unlimited students</li>
                <li><Check /> Teacher cockpit</li>
                <li><Check /> SSO & roster sync</li>
                <li><Check /> Quarterly impact reports</li>
              </ul>
              <a href="/contact" className="btn btn-ghost">Book a call <Arrow size={12} /></a>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- FAQ (client island) ---------- */}
      <HomeFAQ />

      {/* ---------- FINAL CTA ---------- */}
      <section className="cta-final" id="cta">
        <div className="container">
          <div className="cta-card">
            <span className="eyebrow" style={{ position: "relative" }}>
              Two minutes to set up · 14 days free
            </span>
            <h2 className="h-section">
              Add your child. Upload one worksheet.
              <br />
              <span className="serif-italic accent">Watch them think.</span>
            </h2>
            <p>
              Echo is waiting. The kids who get this early will be the ones who lead — not just
              cope with — what&apos;s coming. The trial is free for 14 days. There&apos;s no catch.
            </p>
            <div className="cta-actions">
              <a href="/register" className="btn btn-violet btn-lg">Start free trial <Arrow /></a>
              <a href="/pricing" className="btn btn-ghost btn-lg">See pricing</a>
            </div>
            <div className="echo-corner">
              <Image src="/echo.png" alt="Echo" fill sizes="220px" style={{ objectFit: "cover", transform: "scale(1.4) translate(-6%, -10%)" }} />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function SafetyFeat({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="safety-feat">
      <div className="icon">{children}</div>
      <div className="ftitle">{title}</div>
      <div className="fdesc">{desc}</div>
    </div>
  );
}

function DashListItem({ title, sub, meta }: { title: string; sub: string; meta: string }) {
  return (
    <div className="dash-list-item">
      <span className="check">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
      </span>
      <div>
        <div style={{ fontWeight: 500 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: "var(--ink-muted)" }}>{sub}</div>
      </div>
      <span className="meta">{meta}</span>
    </div>
  );
}
