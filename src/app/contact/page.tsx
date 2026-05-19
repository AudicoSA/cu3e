export const metadata = {
  title: "Contact · CU3E",
  description: "Get in touch with the CU3E team.",
};

export default function ContactPage() {
  return (
    <section className="container" style={{ maxWidth: 640, padding: "80px 0 96px" }}>
      <span className="eyebrow">Contact</span>
      <h1 className="h-section" style={{ marginTop: 12, fontSize: "clamp(32px, 4.4vw, 48px)" }}>
        We&apos;re actually <span className="serif-italic accent">here.</span>
      </h1>

      <p style={{ marginTop: 24, color: "var(--ink-soft)", fontSize: 17, lineHeight: 1.65 }}>
        CU3E is small. A real person reads everything that comes in — usually the
        founder. No support queue, no help-desk wall.
      </p>

      <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 16 }}>
        <ContactCard
          label="General questions"
          email="hello@cu3e.co.za"
          desc="If you're a parent thinking about using CU3E, or a teacher curious how it might work in your classroom."
        />
        <ContactCard
          label="For schools"
          email="schools@cu3e.co.za"
          desc="Volume pricing, teacher cockpits, integration with existing learning systems."
        />
        <ContactCard
          label="Privacy / data"
          email="privacy@cu3e.co.za"
          desc="Any concern about your child's data, account deletion, or compliance."
        />
        <ContactCard
          label="Press / partnership"
          email="kenny@cu3e.co.za"
          desc="Reach the founder directly."
        />
      </div>

      <p
        style={{
          marginTop: 48,
          fontSize: 12,
          color: "var(--ink-muted)",
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.06em",
        }}
      >
        Limited beta · email response within one business day
      </p>
    </section>
  );
}

function ContactCard({
  label,
  email,
  desc,
}: {
  label: string;
  email: string;
  desc: string;
}) {
  return (
    <a
      href={`mailto:${email}`}
      style={{
        display: "block",
        padding: 24,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        textDecoration: "none",
        transition: "border-color 180ms ease, background 180ms ease",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--ink-muted)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 22,
          letterSpacing: "-0.01em",
          color: "var(--violet)",
          marginTop: 6,
        }}
      >
        {email}
      </div>
      <p style={{ marginTop: 8, color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.55 }}>{desc}</p>
    </a>
  );
}
