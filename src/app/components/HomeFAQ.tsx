"use client";

import { useState } from "react";

const FAQS = [
  {
    q: "Will Echo just do my child's homework for them?",
    a: "No — and not because we tell it not to. The system is architecturally built around Socratic guidance: the AI's job is to ask the next good question, not to give the answer. The rule is baked into the system prompt and the product flow. Even when a kid begs, Echo redirects.",
  },
  {
    q: "Is my child's data safe?",
    a: "Built privacy-first. CU3E is designed to meet POPIA (South Africa) and GDPR principles: minimal data collection, no sale to third parties, no training of public AI models on children's conversations. Parents can delete their child's account and data at any time. Independent audit is planned before public launch — we'll publish results when it's done.",
  },
  {
    q: "What if my child uses a different curriculum?",
    a: "Echo is curriculum-agnostic in practice — upload any worksheet, lesson notes, or textbook chapter and it adapts. We're building starter packs for CAPS (South Africa), Common Core (US), GCSE/A-Levels (UK), IB, and the Australian Curriculum, which you can one-click activate from the library.",
  },
  {
    q: "How much screen time is involved?",
    a: "Sessions are soft-capped at 25 minutes by default — roughly the focused-learning sweet spot most research points at. You can lower or raise that in one tap from the parent dashboard.",
  },
  {
    q: "What age is this for?",
    a: "Built for ages 6–14. The voice and depth shift automatically based on the child's age — a 6-year-old gets short, playful, one-idea-per-sentence responses; a 12-year-old gets treated like a smart older friend.",
  },
  {
    q: "Is CU3E available today?",
    a: "We're in early access. CU3E is being tested with a small group of families ahead of broader public launch. Sign up now and you're early — expect occasional rough edges, direct contact with the team, and real input on what gets built next.",
  },
  {
    q: "What about the Edu-Box / Raspberry Pi tier?",
    a: "Coming. The current vision: a small home device where your data lives on your network. The 'fully offline AI' part is harder than it sounds — current small models that run on a Pi are nowhere near Echo's quality. So the realistic first version is a privacy-tier device where data stays at home and the AI is called from the cloud only when needed. Updates as we build it.",
  },
];

export default function HomeFAQ() {
  const [open, setOpen] = useState<number>(0);
  return (
    <section className="faq" id="faq">
      <div className="container faq-grid">
        <div>
          <span className="eyebrow">Honest answers</span>
          <h2
            className="h-section"
            style={{ marginTop: 16, fontSize: "clamp(28px, 3.4vw, 44px)" }}
          >
            Questions <span className="serif-italic accent">parents actually ask.</span>
          </h2>
          <p style={{ color: "var(--ink-soft)", marginTop: 20, fontSize: 14.5, lineHeight: 1.6 }}>
            Don&apos;t see yours? Email us at{" "}
            <a href="mailto:parents@cu3e.co.za" style={{ color: "var(--violet)" }}>parents@cu3e.co.za</a>
            {" "}— we reply within a day.
          </p>
        </div>
        <div>
          {FAQS.map((f, i) => (
            <div
              key={i}
              className={"faq-item " + (open === i ? "open" : "")}
              onClick={() => setOpen(open === i ? -1 : i)}
            >
              <div className="faq-q">
                {f.q}
                <span className="faq-toggle">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                </span>
              </div>
              <div className="faq-a">{f.a}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
