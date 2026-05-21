export const metadata = {
  title: "Privacy · CU3E",
  description: "How CU3E handles children's data.",
};

export default function PrivacyPage() {
  return (
    <section className="container" style={{ maxWidth: 720, padding: "80px 0 96px" }}>
      <span className="eyebrow">Privacy</span>
      <h1 className="h-section" style={{ marginTop: 12, fontSize: "clamp(32px, 4.4vw, 48px)" }}>
        How we handle your child&apos;s data.
      </h1>

      <p style={{ marginTop: 24, color: "var(--ink-soft)", fontSize: 16, lineHeight: 1.65 }}>
        This page is the honest version of what we do today and what we&apos;re committing
        to before public launch. If anything here changes, we&apos;ll update this page.
      </p>

      <Section title="What we collect">
        <p>
          Parent account: your email and name. Child profile: first name, age, grade,
          school (optional), chosen tutor persona. Conversations: every message between
          your child and Echo, plus any homework PDFs you upload. Voice sessions are
          transcribed and stored as text on our side.
        </p>
      </Section>

      <Section title="What we DON'T do">
        <ul>
          <li>We do not sell your data.</li>
          <li>We do not use children&apos;s conversations to train public AI models.</li>
          <li>We do not share child data with advertisers or analytics third parties.</li>
          <li>We do not retain voice audio recordings — only the text transcript.</li>
        </ul>
      </Section>

      <Section title="Who processes what">
        <p>
          Conversation data is sent to large language model providers (Anthropic Claude,
          Google Gemini) and a voice provider (ElevenLabs) only for the duration of
          producing a response. Each provider&apos;s data-processing terms apply for that
          specific call. We&apos;ve chosen providers that contractually commit to NOT training
          their public models on enterprise/API traffic — but the legal arrangement is
          theirs, not ours.
        </p>
      </Section>

      <Section title="Compliance">
        <p>
          We&apos;re designing for POPIA (South Africa), GDPR (EU), and COPPA principles
          (US, ages under 13) from day one — parental consent, data minimisation, the
          right to delete. A formal independent audit is planned before public launch
          and we&apos;ll publish the results.
        </p>
      </Section>

      <Section title="Your controls">
        <p>
          From your dashboard you can: read every conversation your child has had with
          Echo, delete individual conversations or the entire account, and stop
          generation of new content at any time. Account deletion removes all child
          conversations, uploaded PDFs, and weekly digests within 30 days.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Email <a href="mailto:privacy@cu3e.co.za" style={{ color: "var(--violet)" }}>privacy@cu3e.co.za</a>{" "}
          with any privacy concerns. We respond within one business day.
        </p>
      </Section>

      <p style={{ marginTop: 48, fontSize: 12, color: "var(--ink-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>
        Last updated · this page evolves as our practices do
      </p>
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 36 }}>
      <h2
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 24,
          lineHeight: 1.2,
          letterSpacing: "-0.01em",
          marginBottom: 12,
        }}
      >
        {title}
      </h2>
      <div style={{ color: "var(--ink-soft)", fontSize: 15, lineHeight: 1.65 }}>{children}</div>
    </div>
  );
}
