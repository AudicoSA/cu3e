const Check = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);
const Arrow = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
);

export default function Pricing() {
  return (
    <section className="pricing">
      <div className="container">
        <div className="pricing-head">
          <span className="eyebrow">Honest pricing</span>
          <h1 className="h-section" style={{ marginTop: 16 }}>
            Less than <span className="serif-italic accent">one tutoring session</span>
            <br />
            a month. Cancel any time.
          </h1>
          <p
            style={{
              color: "var(--ink-soft)",
              fontSize: 17,
              lineHeight: 1.6,
              maxWidth: 580,
              margin: "20px auto 0",
            }}
          >
            One subscription per household. Hardware tier ships from Cape Town with on-device
            AI — nothing leaves your home network.
          </p>
        </div>

        <div className="plan-grid">
          {/* Trial */}
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
              <li><Check /> All 3 modes (Tutor, Storybook, AI Skills)</li>
              <li><Check /> 1 child profile</li>
              <li><Check /> Parent dashboard</li>
              <li className="muted">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/></svg>
                Multi-child sharing
              </li>
            </ul>
            <a href="/register" className="btn btn-ghost">Start trial <Arrow /></a>
          </div>

          {/* Family - featured */}
          <div className="plan feature">
            <span className="plan-tag">Most parents</span>
            <h3>Family</h3>
            <div className="plan-price">
              <span className="amount">R499</span>
              <span className="period">/ month</span>
            </div>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              Everything for one household. Up to 4 kids. Less than a single tutoring hour.
            </p>
            <ul>
              <li><Check /> Up to 4 child profiles</li>
              <li><Check /> Unlimited tutor + storybook + AI skills</li>
              <li><Check /> Weekly parent reports</li>
              <li><Check /> Curriculum match (CAPS / CC / GCSE / IB)</li>
              <li><Check /> Priority human support</li>
            </ul>
            <a href="/register" className="btn btn-violet">Start free trial <Arrow /></a>
          </div>

          {/* Edu-Box */}
          <div className="plan">
            <h3>Edu-Box</h3>
            <div className="plan-price">
              <span className="amount" style={{ fontSize: 32 }}>Coming soon</span>
            </div>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              A privacy-tier home device: your child&apos;s data lives on your network. Cloud AI is called only when actively asked.
            </p>
            <ul>
              <li><Check /> Pre-configured Raspberry Pi 5</li>
              <li><Check /> Per-family encrypted local storage</li>
              <li><Check /> Offline JupyterLab for early coding</li>
              <li><Check /> Cloud AI on-demand · transparent calls</li>
            </ul>
            <a href="/contact" className="btn btn-ghost">Register interest <Arrow /></a>
          </div>
        </div>

        <p
          style={{
            marginTop: 56,
            textAlign: "center",
            fontSize: 14,
            color: "var(--ink-muted)",
          }}
        >
          Schools and homeschool groups —{" "}
          <a
            href="mailto:schools@cu3e.com"
            style={{ color: "var(--violet)", fontWeight: 500 }}
          >
            talk to us about volume pricing
          </a>
          .
        </p>
      </div>
    </section>
  );
}
