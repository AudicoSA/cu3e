# CU3E — Open work

Single-page snapshot. Grouped by *when*, not by feature area.

---

## Strategic gates

**Pre-launch must-fix:**
- Rotate live API keys (`ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`) — values appeared in chat history; rotate before any non-family user hits prod.
- Stand up the `partnerships@cu3e.co.za` mailbox referenced on `/contact` (the kenny@ card was replaced in the small-business-syndrome cleanup).
- Attach `cu3e.co.za` to Vercel + update DNS (currently a parked-domain page on Apache; testing happens on `cu3e-hazel.vercel.app`). Whenever Kenny wants to flip the public URL.

**Gated on "concept works → go to market":**
- **Unbundle ElevenLabs Conversational AI → direct TTS + Web Speech STT + our LLM.** Drops EL voice cost from ~$0.08/min session to ~10-20¢ per 5-min chat (~80-90% reduction). Same Echo voice (we already use EL TTS standalone for the weekly overview). ~1 day of focused work. Don't ship until subscription cost actually starts to matter.

---

## Voice-ergonomics polish (kiosk experience)

Mostly shipped, two open items:

- **Page-level Wake Lock on `/study-hub`** so the kiosk tablet never auto-sleeps from study-hub regardless of Android settings. Today we only hold the lock while the screensaver is up; OS can sleep before the screensaver activates.
- **Per-session voice minute budget** + UI cap. Belt-and-braces with the 45s auto-sleep — defends against runaway EL spend if any client-side detection ever misses.

---

## Echo Remembers — context staleness

- **Time-decay the memory brief so a new day = a fresher start.** Kenny on 2026-05-23: *"tatum started a new chat — and it went on about something from yesterday — so perhaps context can time out, so if its a new day it can start again"*. Current behaviour: `children.memory_brief` is a running 30-day Haiku summary, injected into every system prompt, leading with a "Last session" bullet. Great for resuming a chat that ended mid-thought a few hours ago; jarring when a 6yo starts a NEW chat the next morning and Echo opens with yesterday's specific topic she's already moved on from. Three layered fixes (pick one or combine):
  1. **Date-stamp every bullet in the brief** (Haiku prompt change) and instruct Echo in the system prompt to *only* surface a bullet proactively if the date is within the last 12 hours. Older bullets stay in context (for *if asked*) but Echo doesn't lead with them.
  2. **Conditional "Last session" bullet** — re-frame Haiku's first bullet only when the most recent `chat_messages.created_at` is within ~12 hours; otherwise omit the bullet entirely and let Echo open generically ("Hey Tatum, what's up today?").
  3. **Server-side opener decision** — in `/api/voice-session`'s opener-synth prompt, pass `hours_since_last_session` and instruct: "if > 12, open as if it's a fresh day; if ≤ 12, pick up where we left off". The opener stays warm-aware without being a stranger OR a stalker.

  **Recommended:** ship #3 first (smallest change, biggest UX win, only touches /api/voice-session). Then #1 as a follow-up so text chat gets the same intelligence. Don't ship all three at once — risk over-correcting and losing the continuity that's a real differentiator.

---

## Product

- **Multi-region curriculum library — pre-loaded starter packs.** This is a *promise made on the homepage FAQ* ("we're building starter packs for CAPS (SA), Common Core (US), GCSE/A-Levels (UK), IB, and the Australian Curriculum, one-click activate from the library"). The plumbing already exists — `curriculum_library` table, Library tile in study-hub, `/api/library/promote`, one-click activate flow. The gap is *content + curation*, not engineering. Scoping:

  **What "starter pack" should contain (per curriculum):**
  - Maths: 3-5 worksheet PDFs per grade (1-9), covering the major topics for that year. Grade 10-12 algebra/geometry/calculus for senior packs.
  - English: literacy/phonics packs for grades 1-4; comprehension + essay-prompt packs for grades 5-12.
  - Science: physical + life science worksheets, grades 4-12.
  - Optional v2: history, geography, second-language packs.

  **Content sourcing options (in order of legal cleanliness):**
  - Original CU3E worksheets — write our own from scratch. Slow, fully ours, no licensing risk. Could AI-generate first drafts and human-review.
  - Open-licensed material — Siyavula textbooks (CC BY-NC) for CAPS STEM, OpenStax for US, MIT OCW etc. Need to verify each license + attribute properly.
  - Public-domain past papers — many education ministries publish past exam papers. Free to host with attribution.
  - DO NOT host copyrighted publisher content (Macmillan, Pearson, Maskew Miller) without written permission.

  **MVP definition (one curriculum, proving the flow):**
  - Pick **CAPS** as the first pack (Kenny is SA, Tatum + Ella are CAPS, Siyavula CC content is available, the Library UI is already there).
  - Seed ~12-15 PDFs covering Foundation Phase maths + literacy (Grades 1-3) so Tatum is a real test case.
  - Each PDF needs `/api/extract-pdf` to run so it's queryable by Echo from upload.
  - Tag each row with `region`, `grade`, `subject`, `is_published=true`, `source_attribution`.

  **Engineering needed for MVP:** roughly zero — flow already exists end-to-end. Possibly a small filter UI ("Filter library by region/grade/subject") if the pack count grows.

  **Real-time estimate:** ~2-3 days per curriculum if AI-generating with human review; ~1 week+ per curriculum if hand-curating from open sources. Total to fulfil the FAQ promise: 2-6 weeks depending on depth + how many curricula we ship at v1.

  **Until this exists**, the FAQ answer is overpromising — soften the copy ("CAPS pack coming first, with others on the roadmap") OR build at least one pack before promoting the line.
- **Higgsfield Seedance for "story climax" video** — a standout moment per storybook generates a short animated video instead of a static image. Needs `HIGGSFIELD_API_KEY` + custom fetch integration.
- **Owl idle animation** — subtle blinking / head-turn / "thinking" states for Echo on the chat avatar. Lottie or CSS. The screensaver already has the gentle breathing version; this is the in-chat one.
- ~~`/parents` deep-dive page~~ — SHIPPED 2026-05-23. Reuses the real `ChildAnalytics`, `NotificationsBanner`, and (extracted) `CurriculumProgressCard` with mocked Tatum + Ella data so visitors see exactly what they'd get post-signup. Five slabs: hero, activity charts, breakthroughs, AI Skills progress, worksheet progress, Sunday-briefing recap, final CTA. Sunday-briefing homepage link now points at `/parents`. Header nav "For parents" same.

- **Multilingual support — Afrikaans first, then Zulu/Xhosa.** Potential game-changer for SA market (where Maski, Aida, Luma compete free on WhatsApp in English). Strategic call: Afrikaans first because (a) Ashton-tier families have Afrikaans home-speakers and it deepens the existing premium segment without diluting positioning, (b) AI model quality in Afrikaans is near-English so it's a clean shipping test before tackling Bantu languages, (c) genuinely underserved by current SA AI tutors. Implementation: add `children.preferred_language` column → inject into system prompts in `/api/chat` and `/api/voice-llm` ("Speak to ${name} in ${language} unless they switch to English"). EL agent multilingual config for voice. UI i18n via next-intl. MVP ~1 day, full polish ~5 days. Already flagged on homepage pricing tier and FAQ as "English now · Afrikaans & Zulu next".

---

## Tech debt / paper cuts

- **`createServerClient` cookie API deprecation** — Supabase SSR is warning the old `cookies.get()` signature is deprecated. Migrate to `getAll`/`setAll`.
- **Migrate other pages to design-system tokens** — login / register / dashboard / skills / study-hub partially on inline styles. Should eventually use the same class-based system as the homepage.

---

## Recently shipped (last 3 days, for context)

- ✅ Storybook scene persistence + chat resume on reload
- ✅ AI Skills expansion: 5 → 50 modules across 10 categories, with tiers, waitlist, and Nano-Banana tile imagery
- ✅ Edu-Box → CU3E Tablet honest copy on dashboard
- ✅ Small-business-syndrome scrub across `/contact`, `/pricing`, homepage, FAQ, privacy, layout footer
- ✅ Mature voice for 10+ (env-var driven `ELEVENLABS_VOICE_ID_MATURE`)
- ✅ Echo Remembers (per-child `memory_brief`, refreshed daily via Haiku, injected into text + voice prompts)
- ✅ Reading mode (fifth chat mode — Echo as reading coach)
- ✅ Breakthrough push (in-app banner on dashboard when grader sees a strong session)
- ✅ Voice memory gap closed (refresh now fires from voice-save + voice-sync; auto-flush on disconnect)
- ✅ Story-rescue when a young kid gets stuck (age-banded)
- ✅ Practice carve-out — Echo no longer refuses counting / phonics / drills
- ✅ FAB "Talk to Echo" floating button on study-hub
- ✅ Wake word "Echo" (Web Speech, kiosk-mode toggle, desensitised to ignore interim/long/in-word matches)
- ✅ Bedside screensaver with clock + owl + Wake Lock
- ✅ Auto-end on 45s silence + hard-close on detected sleep intent
