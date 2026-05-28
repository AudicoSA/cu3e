# CU3E — Open work

Single-page snapshot. Grouped by *when*, not by feature area.

---

## Strategic gates

**Pre-launch must-fix:**
- Rotate live API keys (`ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`) — values appeared in chat history; rotate before any non-family user hits prod.
- Stand up the `partnerships@cu3e.co.za` mailbox referenced on `/contact` (the kenny@ card was replaced in the small-business-syndrome cleanup).
- Attach `cu3e.co.za` to Vercel + update DNS (currently a parked-domain page on Apache; testing happens on `cu3e-hazel.vercel.app`). Whenever Kenny wants to flip the public URL.

**Gated on "concept works → go to market":**
- **Unbundle ElevenLabs Conversational AI → direct TTS + Web Speech STT + our LLM.** TWO independent reasons to ship this, either alone makes it worth doing:
  1. **Cost.** Drops EL voice cost from ~$0.08/min session to ~10-20¢ per 5-min chat (~80-90% reduction). Same Echo voice (we already use EL TTS standalone for the weekly overview).
  2. **Bandwidth — this is a Phase 2 (Android tablet rental) GATE, not a nice-to-have.** Current EL Conversational AI holds an open WebSocket with continuous ~50-100 kbps audio both ways. Works on good 3G, glitches on marginal 3G, dies on Edge / 2G. With unbundling: per turn is ~55 KB (5 KB text + 50 KB TTS audio response), works on the same connection that already handles text chat. Without this change, a heavy kid on Phase 2 burns ~750 MB-2 GB/month of cellular data on voice alone — blows the R450 rental price model. With it: under R300/month total data even for heavy use.
  - ~1 day of focused work. Ship before Phase 2 fleet pilot, or alongside it.

---

## Voice-ergonomics polish (kiosk experience)

Mostly shipped, two open items:

- ~~Page-level Wake Lock on `/study-hub`~~ — SHIPPED 2026-05-23. New `useWakeLock()` hook holds a screen lock for the whole study-hub session and re-acquires on visibilitychange. Tablet stays awake regardless of Android display-timeout settings.
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

- **CAPS subject catalogue — SHIPPED (263 packs across 9 subjects).** Each subject = its own `seed_caps_*.py` script (intentionally self-contained for easy reading + edit-one-thing-at-a-time iteration). Refactor into shared `seed_lib.py` is fine but not urgent — the duplication is stable plumbing.
  - ✅ Mathematics — 48 packs G1-9 (`seed_caps_foundation.py`)
  - ✅ English Home Language — 45 packs G1-9 (`seed_caps_english.py`)
  - ✅ Natural Sciences — 30 packs G4-9 (`seed_caps_natural_sciences.py`)
  - ✅ Afrikaans FAL — 32 packs G1-9 (`seed_caps_afrikaans_fal.py`). Pairs with Charles Onselen voice.
  - ✅ isiZulu FAL — 32 packs G1-9 (`seed_caps_isizulu_fal.py`). **NATIVE-SPEAKER REVIEW PENDING** — flagged in source_attribution. Kenny's friend (native isiZulu speaker) is the right reviewer + voice-clone subject.
  - ✅ Life Skills / Life Orientation — 26 packs G1-9 (`seed_caps_life_orientation.py`). Health, safety, relationships, citizenship, careers, mental health.
  - ✅ Social Sciences — 25 packs G4-9 (`seed_caps_social_sciences.py`). SA + world history + geography.
  - ✅ Economic & Management Sciences — 12 packs G7-9 (`seed_caps_ems.py`). Money, business, banking, SA economy.
  - ✅ Creative Arts — 13 packs G4-9 (`seed_caps_creative_arts.py`). Visual art, music, drama, dance.
  - **Content quality follow-ups:**
    - isiZulu FAL needs native-speaker pass + voice clone for audio side
    - Afrikaans FAL is v1 — could use teacher review (Adriaan's friend / Tatum's teacher at Ashton?)
    - Life Orientation Senior Phase (G7-9) touches sensitive topics (substance abuse, sexuality, mental health) — content is age-appropriate but parents may want preview / opt-out per-child setting eventually
  - **Next regions** (when CAPS is mature): Common Core (US), GCSE/A-Levels (UK), IB, Australian Curriculum — same script template, swap region + content. Each is its own multi-week effort.

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
- ~~Owl idle animation~~ — SHIPPED 2026-05-23. Pure CSS — gentle breathe + occasional blink (brightness flash, weighted heavily toward eyes-open so it reads as a real blink). Applied to chat-header avatar + each Echo message bubble's avatar; staggered animation-delay so multiple owls don't blink in unison. Respects `prefers-reduced-motion`.
- ~~`/parents` deep-dive page~~ — SHIPPED 2026-05-23. Reuses the real `ChildAnalytics`, `NotificationsBanner`, and (extracted) `CurriculumProgressCard` with mocked Tatum + Ella data so visitors see exactly what they'd get post-signup. Five slabs: hero, activity charts, breakthroughs, AI Skills progress, worksheet progress, Sunday-briefing recap, final CTA. Sunday-briefing homepage link now points at `/parents`. Header nav "For parents" same.

- ~~Multilingual support — Afrikaans first, then Zulu/Xhosa~~ — SHIPPED 2026-05-23 with **Afrikaans AND isiZulu** simultaneously (Kenny: "then isiZulu please"). Migration 018 adds `children.preferred_language` with CHECK ('en','af','zu'). New `src/lib/languages.ts` is single source of truth — `buildLanguageDirective(code, name)` returns a language-specific system-prompt prefix that handles bilingual code-switching, age-appropriate register, and the English-for-technical-terms allowance for isiZulu. Wired into `/api/chat`, `/api/voice-llm`, and `/api/voice-session`. AddChildForm has a new "Echo speaks" picker, with inline per-child `ChildLanguagePicker` on the dashboard. Adding Xhosa later is one edit per file (lib + migration + UI option).
  - **UI itself stays in English** for MVP. Chat surface labels, buttons, mode names — all English. Echo's *output* is the Afrikaans/Zulu piece. Full UI i18n (next-intl) is the Phase 2 polish.

- **Native-voice TTS for Afrikaans + isiZulu** (real follow-up to the multilingual ship). Kenny tested Adele on Afrikaans → bad pronunciation. Investigation: **EL's public voice library has zero voices fine-tuned natively for Afrikaans or isiZulu**. The "South African" voices (Adele zx7xpccUD1nCkqUuxIGc, Thandi BcpjRWrYhDBHmOnetmBl, Charles Onselen IT5cb4lfodSX8eyXUzyO) are all listed as "Languages: en (south african)" — SA-accented *English* speakers. Feeding them non-English text → English-phoneme mispronunciation. Currently `lib/languages.ts` has `voiceId: null` for af/zu so we fall back to the agent's default voice (also English-trained — same problem, but at least it's the consistent Echo voice).
  - **Decision: voice-clone via paid native speakers (Fiverr).** Scraping online narratives is a non-starter — ElevenLabs ToS requires rights to the voice, and a person's voice is a personality right in SA. The cheapest, fastest, legally clean path is hire-a-narrator. Total ~R1000, ~1 day from gig post to live voices.
  - **Concrete plan:**
    1. **Post 2 Fiverr gigs** (or 1 if a SA voice actor speaks both): one Afrikaans, one isiZulu native speaker.
       - **Brief:** "Record ~5 minutes of clean studio audio in [language] reading the provided children's tutoring script. Deliver as 48kHz mono WAV, no music, no edits. **Full commercial rights transfer** for use in our education app (specify this in writing). Budget R200-500 per language."
       - Search terms: "Afrikaans voice over", "Zulu voice over", "South African voice actor". Fivver SA-based actors typically deliver in 1-3 days.
    2. **Recording script** (we provide — should give EL the phonetic coverage it needs to clone well). Cover:
       - Greetings + small talk (warm, conversational range)
       - Counting numbers 1-20 + days of the week (everyday vocab)
       - A short kids' story paragraph (narrative tone)
       - A few teacherly explanations ("So, when we add three and four together...") (pedagogical tone)
       - Some quiet/calm sentences ("Take your time. That's a good question.") (study-mode tone — important now that Echo is calm-energy)
    3. **Once WAVs arrive:**
       - Upload to EL Voice Lab → Professional Voice Clone (paid tier) for each
       - Test the clones with sample sentences from each tone register
       - Update `src/lib/languages.ts` voiceId for `af` and `zu`
       - Test end-to-end on /study-hub with a child set to that language
       - Re-enable `agent.language` override in VoiceTalk.tsx once the EL agent has language_presets registered (currently disabled — see "Also discovered" note below)
  - **Fallback options if Fiverr doesn't work out:**
    - **Kenny's friend records for free** (still the cleanest option for isiZulu — a friend who consents is identical legally to a paid actor)
    - **Google Cloud TTS** for non-English voices — production-grade native af-ZA + zu-ZA. ~1 day of engineering to route non-English sessions through Google instead of EL. Downside: not the same Echo voice across languages.
    - **Open-source TTS (Meta MMS-TTS-zul / MMS-TTS-afr)** — free, self-host, lower quality. Last-resort.
  - **Also discovered during testing:** EL agent's `platform_settings.overrides.conversation_config_override` had both `tts.voice_id: false` and `agent.language: false` from the original config — meaning **all voice overrides have been silently rejected, including the mature voice for 10+ shipped earlier**. PATCHed to `true` for both via direct API call. Mature voice (`ELEVENLABS_VOICE_ID_MATURE` env) should now actually take effect when set.
  - **Also discovered:** EL requires the agent's `language_presets` to include `'af'`/`'zu'` BEFORE accepting `overrides.agent.language` at session-start. Direct PATCH attempts to add these silently failed (possibly UI-only or premium-tier). Currently the agent.language override is disabled in `VoiceTalk.tsx` — so EL's STT defaults to English mode for Afrikaans/Zulu sessions. STT quality on non-English speech will degrade. Re-enable when the agent has proper language presets registered.

---

## Phase 2 — Locked-down Android tablet stack (rental market)

**Strategic gate:** start once CU3E concept is validated with paying web users (the "concept works → go to market" line at the top of this doc). Until then this is shelf-ready, not in-flight.

**Why it matters:** the PWA serves middle-class families with their own iPad / laptop. The locked-tablet rental unlocks tens of millions of SA people who can't drop R5000 on hardware but could swing ~R150-450/month for a complete bundle (device + data + CU3E + replacement reserve). It's also a hardware moat — kids form a relationship with the physical thing — and opens distribution angles the pure web app can't reach (NGOs, mining-co education benefits, government tablet rollouts, kiosk sign-up at pharmacies / spaza shops).

**Why it's tractable:** CU3E is already a PWA. The "app" is just a 2 MB WebView wrapper around `cu3e.co.za/study-hub`. Every Vercel deploy reaches every tablet instantly — no Play Store reviews, no version skew, no update friction. Most of the work is the Android shell, not re-implementing the product.

### MVP component checklist (~7-10 days focused work)

- [ ] **APK wrapper** — Android WebView, fullscreen, no Chrome chrome. Opens the live PWA URL. ~1 day.
- [ ] **Kiosk lockdown** — Android Lock Task Mode (official since Android 5). Tablet locked to CU3E only: no notification shade, no home button, no recents, no quick settings, no Play Store. Survives reboot. Requires being set as device owner via ADB on first boot (`dpm set-device-owner`). ~1-2 days.
- [ ] **Boot replacement** — replace the home launcher so the tablet boots straight into CU3E. ~1 day.
- [ ] **Hardware controls** — volume keys, sleep button, rotation lock, brightness — kid-safe defaults. ~1 day.
- [ ] **Parent unlock** — pin code (or QR code generated from parent dashboard) escapes kiosk for setup, troubleshooting, factory reset. ~1 day.
- [ ] **Provisioning script** — Bash + ADB setup script + QR-code provisioning (Android 7+). Factory-fresh tablet → fully locked + linked to a parent account in ~2 minutes. Essential at fleet scale. ~1 day.
- [ ] **Phone-home heartbeat** — tablet pings a CU3E endpoint every 24h with battery / data-used / last-seen / child active. Lets us notice broken devices, theft, dormant accounts. ~half day.

### Hardening (extra 2-3 weeks before real fleet use)

- [ ] OTA firmware updates (we control the APK; security patches need a path)
- [ ] **Offline mode + cache** — load-shedding + flaky-3G reality. Activated worksheet + extracted_text + last memory brief stored locally so a mid-session dropout doesn't lose context. Chat messages queue + sync when back online. Voice mode falls back gracefully to text when offline.
- [ ] **Network-aware degradation** — read `navigator.connection.effectiveType` + `saveData`. On 2G / Edge / save-data: disable voice mode entirely, force text-only, hide image-generation buttons, show small "low-data mode" banner so the parent understands why. On good 3G+: full experience.
- [ ] **Data-usage telemetry per session** — we don't yet know real bandwidth per kid (voice mode is the unknown). Phone-home heartbeat should report MB used / sessions today so we can calibrate the rental data bundle correctly before scaling.
- [ ] Theft / unpaid-rental kill switch (server-side disable)
- [ ] Multi-child profile switching on the device (one tablet → 2 siblings)
- [ ] Hardware QC checklist + supplier vetting (cheap tablets break a LOT — touch dead zones, charge port failures, microphone defects are common)
- [ ] Customer-support workflow (broken tablet → return → replace)

### Rough unit economics to test

- Doogee G5 (or similar Android 11+ tablet): ~R1500 retail
- Cellular data: see table below — depends entirely on whether EL unbundling has shipped
- CU3E subscription: R250/month (current target)
- Logistics + replacement reserve: ~R100/month

**Data cost reality (SA Vodacom prepaid pricing, AFTER EL unbundling):**

| Usage | Voice/month | Misc app | Total | Bundle cost |
|---|---|---|---|---|
| Light kid (30 min/day) | ~50 MB | ~500 MB | ~550 MB | ~R49 |
| Heavy kid (2 hr/day) | ~250 MB | ~1 GB | ~1.25 GB | ~R99 |
| Family of 3 (heavy) | ~750 MB | ~2 GB | ~2.75 GB | ~R199-299 |

**WITHOUT EL unbundling**, voice alone is 5-10× these numbers — heavy use blows past R1500/month in data, which kills the rental price model entirely. That's why EL unbundling is listed as a Phase 2 gate at the top of this doc, not just a cost optimisation.

**Pricing options to A/B:**
- All-in monthly: **~R450/month** — device, data, subscription, replacement covered
- Subsidised: **R150/month + R299 once-off device fee** spread over 24 months — Vodacom Smart Kicka model

### Distribution angles this unlocks

- Direct-to-parent rental (online + WhatsApp sign-up)
- Spaza shops / pharmacies as kiosk-style sign-up points
- NGO partnerships (literacy / kids' charities)
- Mining-company education benefits (Anglo, Sasol, Implats already fund employee kids' education)
- Department of Basic Education tablet rollouts (historically badly executed — opening for a better product)
- Faith communities (a lot of SA parents trust church / mosque / temple as a delivery channel for kid services)

### Pre-launch unknowns to validate

- Real-world data usage per kid per month (voice mode is the unknown — we don't have telemetry on EL session bandwidth yet)
- Tablet breakage rate at the R1500 hardware tier (probably 5-15% per year)
- Willingness-to-pay at R150 / R250 / R450 price points (run a survey before building inventory)
- Whether the SIM-card insertion + APN setup workflow can be made parent-proof
- Whether SA cell networks treat WebSocket-heavy voice traffic well on prepaid bundles

### Reference products to study before building

- Amazon Kids Fire (locked tablet model done well)
- Vodacom Smart Kicka (SA subsidised-device precedent)
- Kano (UK, kid-targeted locked device)
- Project pi / RACHEL (offline education hardware in low-connectivity contexts)
- One Laptop Per Child (the cautionary tale — what went wrong logistically)

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
