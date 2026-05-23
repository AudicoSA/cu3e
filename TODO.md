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
- **`/parents` deep-dive page** — dedicated marketing surface for the rigorous-buyer parent. The Sunday-briefing section on the homepage is the emotional hook (Ava reads a 90s sample); `/parents` is where convinced parents click through to see the *substance*: dashboard tour, charts, breakthrough notifications, per-skill progress ladder, weekly trend lines. The current "Plus a parent dashboard with charts…" link on the homepage points at `/pricing` as an interim — should point at `/parents` once it exists. Keeps the homepage breathing room while giving serious buyers a real conversion close.

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
