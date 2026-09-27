# CU3E × Gemini 3.8 Live Avatar — Implementation Plan

*Prepared 27 Sep 2026 · Based on the Google announcement of 24 Sep 2026 and a read of the `AudicoSA/cu3e` codebase (Next 16.2 / React 19 / Supabase / ElevenLabs ConvAI / Vercel)*

---

## 0. TL;DR

- **What it is:** Gemini 3.8 Live is Google's new speech-to-speech model. **Live Avatar** adds a lip-synced, expressive talking video face to that same live session. The model hears the child, thinks, speaks *and* animates the face in one stream. It understands and speaks **97 languages**, can **see a camera feed or screen share** while talking, and can **call tools in the background without pausing the conversation**. It went GA on **24 Sep 2026**.
- **Why it matters for CU3E:** it could turn Echo from a static owl with pulse rings into a face that talks back. The same move could also fix three open TODO items: the missing native Afrikaans/isiZulu voices, the English-only STT in non-English sessions, and "look at my homework" through the camera.
- **The catches (all real):**
  1. **Enterprise-only.** It's available only on Google Cloud's *Gemini Enterprise Agent Platform* (formerly Vertex AI), not on the Gemini API / AI Studio key CU3E uses today.
  2. **Custom avatars are allowlist-only.** To get Echo the owl you have to apply to Google, and the input must be a portrait **9:16, ≥704×1280** image plus an audio sample. It isn't yet known whether a non-human robot owl will animate well. Preset avatars work on day one.
  3. **Cost:** about **$0.37 per minute while the avatar is speaking**, plus audio and input tokens. That's roughly 4–5× the current ElevenLabs cost of ~$0.08/min.
  4. **Bandwidth:** the output is a continuous H.264 video stream. That's the opposite of what the Phase 2 low-data Android tablet needs.
  5. **Short sessions:** only "a few minutes" of continuous avatar interaction, and a ~10-minute WebSocket lifetime. Session resumption is mandatory.
  6. **Kids + terms:** Google's *Gemini API* terms **forbid** apps "directed towards or likely to be accessed by individuals under 18". Those terms don't govern Google Cloud, but you need written confirmation of what the Cloud/Enterprise terms allow before any child uses it. **This also affects today's `story-image` and `skill-images` routes, which call Nano Banana on a Gemini API key.**
- **Recommendation:** treat Live Avatar as a **premium, Wi-Fi-only "Face-to-Face with Echo" mode** that sits *alongside* the existing ElevenLabs voice. Don't replace it yet. Run it in 5 phases, starting with a 1-week technical and legal spike. Nothing ships to kids until Gate 0 (legal) and Gate 1 (quality and cost) pass.

---

## 1. What Google actually shipped (research summary)

| Item | Detail | Confidence |
|---|---|---|
| Model ID | `gemini-3.8-live` (also `gemini-3.8-live-extended-thinking`, private preview) | High (Google skill doc) |
| Launch | GA 24 Sep 2026 in Gemini Enterprise | High |
| Where | Gemini Enterprise Agent Platform → Studio → Multimodal Live; Live API (`bidiGenerateContent` WebSocket) | High |
| Regions | US and EU endpoints only (no `africa-south1`) | High |
| Languages | 97, automatic language detection, lip-sync adapts per language | High (count); **af/zu unverified** |
| Avatars | Preset library for all customers; custom from reference image + audio sample + system instructions, **allowlist + verification only** | High |
| Custom image spec | Portrait, 9:16, min 704×1280, JPEG/PNG inline bytes | Medium (from LiteLLM issue quoting SDK types) |
| Config shape | `AvatarConfig(avatar_name="Kai", customized_avatar=CustomizedAvatar(image_mime_type, image_data))` in the live connect config; ADK exposes `RunConfig.avatar_config` | Medium |
| Output | Fragmented MP4 blobs (**H.264 video + AAC-LC audio muxed**) replace raw PCM audio when avatar is on | Medium |
| Input audio | PCM 16-bit mono 16 kHz (`audio/pcm;rate=16000`) | High |
| Video input | JPEG frames via `sendRealtimeInput({ video })`, camera or screen share | High |
| Tools | Async function calling (`behavior: NON_BLOCKING`); avatar keeps talking while tools run | High |
| Limits | "A few minutes" of continuous avatar interaction; connection ~10 min (needs session resumption); 128k input context; output cap drops to **24k tokens with avatar** (64k without) | Medium |
| Pricing (per 1M tokens) | Avatar video out **$1** · audio out $12 · audio in $3 · text in $0.75 · image/video in $1 · text out $4.50 | Medium (secondary sources) |
| Video billing | 6,192 tokens/sec, **billed only while the avatar speaks** → ≈ **$0.37 per speaking minute** + ~$0.018/min audio out | Medium |
| Safety | SynthID watermark in all audio and video output | High |
| Browser auth | Ephemeral tokens exist for Gemini API only; **not supported on Vertex/Enterprise**, so a server-side WebSocket relay is needed | High (js-genai #766) |

---

## 2. Where CU3E is today (codebase findings)

| Area | Current implementation | File(s) |
|---|---|---|
| Voice session start | Server mints an ElevenLabs signed URL, synthesises a generic opener with Haiku, builds dynamic vars (name, age band, memory brief, language) | `src/app/api/voice-session/route.ts` |
| Voice "brain" | EL calls our custom-LLM endpoint, which injects `[CU3E_META]`, the memory brief, active curriculum text and the language directive, then proxies to **gpt-4o-mini** | `src/app/api/voice-llm/[[...path]]/route.ts` |
| Voice UI | Full-screen overlay: static `echo.png` in pulse rings, status label, 45 s silence auto-end, sleep-intent regex, transcript flush → `/api/voice-save` → `/api/grade-session` | `src/app/components/VoiceTalk.tsx` |
| Entry points | Study-hub FAB, wake word "Echo", screensaver | `TalkToEchoFab.tsx`, `useWakeWord.ts`, `Screensaver.tsx` |
| Modes | `tutor`, `storybook`, `skills`, `reading` | `src/app/study-hub/page.tsx` |
| Camera | Snap-a-worksheet capture (still image) | `CameraCapture.tsx` |
| Languages | `en` / `af` / `zu`. **No native af/zu voices in EL; EL STT stuck in English** (language override disabled) | `src/lib/languages.ts` |
| Memory | `children.memory_brief` (daily Haiku summary) | `src/lib/memory.ts` |
| Google usage | `gemini-2.5-flash-image` via `@ai-sdk/google` + `GOOGLE_GENERATIVE_AI_API_KEY` (Gemini API, AI Studio terms) | `story-image`, `skill-images/seed` |
| Echo character | Square 1024×1024 robot-owl render, dark neon scene | `public/echo.png` |

**Key architectural implication:** today the voice brain is *ours* (a custom LLM behind EL). Gemini Live is an end-to-end speech model, so **the brain moves to Gemini**. All the prompt engineering in `voice-llm` (age bands, practice carve-out, story rescue, language directive, curriculum injection, safety rules) must be **ported into the session's `systemInstruction` plus tools**. That port is the biggest piece of work, not the video.

---

## 3. Product design: how the avatar shows up in the Tutor app

### 3.1 The feature: "Face-to-Face with Echo"
- A new option inside the existing voice overlay. The child taps the FAB (or says "Echo") and, if the device qualifies, sees **Echo's face** instead of the static owl.
- **Tutor mode first.** Tutor is the mode where face-to-face explanation matters most. Then Reading mode (Echo listens to the child read aloud and reacts visibly), then Storybook (narrator face).
- **Homework lens:** while the avatar is live, the child can flip on the tablet camera. Echo *sees the worksheet in real time* ("Point at the one you're stuck on"). This upgrades the current snap-and-upload `CameraCapture` into continuous visual understanding.

### 3.2 Which face?
| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **A. Google preset avatar** (human, curated) | Day-one access, no allowlist | Not "Echo"; brand break; realistic human face may unsettle 6-year-olds | **Spike and pilot only** |
| **B. Custom Echo owl** (allowlisted) | Brand continuity; kids already love the owl; a stylised non-human character avoids the uncanny valley | Needs allowlist; needs a new 9:16 portrait render; unknown whether a non-human, beak-mouthed character lip-syncs acceptably | **Target** |
| **C. Custom friendly human "teacher"** (licensed likeness) | Likely best lip-sync quality | Likeness rights, cost, off-brand, child-safety optics | Fallback only |

**Action:** commission a **9:16, 1080×1920 front-facing Echo portrait** now (Higgsfield/Nano Banana, clean background, the owl facing camera, beak clearly visible, head-and-shoulders framing, soft lighting). Keep the scene simpler than `echo.png`. That's the asset the allowlist application will need.

### 3.3 Age-band behaviour
- **Little (≤9):** stylised owl only (never a realistic human), shorter turns, bigger captions, parent opt-in required.
- **Big (10+):** owl default; realistic presets allowed only if a parent explicitly enables them.

### 3.4 Eligibility gating (automatic)
Show the avatar only when **all** of these are true, otherwise fall back silently to today's EL voice:
- `navigator.connection.effectiveType === '4g'` and `!saveData` (Wi-Fi or strong LTE)
- The parent has enabled "Face-to-Face" for this child (new flag)
- The child's avatar-minutes budget for today isn't exhausted
- The browser supports `MediaSource` / `ManagedMediaSource` with `video/mp4; codecs="avc1.*, mp4a.40.2"`

This keeps Phase 2 tablets (2G/3G) on the cheap audio path by design.

---

## 4. Technical architecture

```
 Tablet / browser (study-hub)                    Relay (Cloud Run, europe-west)          Google
 ┌──────────────────────────────┐   WSS    ┌──────────────────────────────┐  WSS   ┌──────────────────────┐
 │ AvatarTalk.tsx               │ ───────► │ cu3e-live-relay (Node)       │ ─────► │ gemini-3.8-live      │
 │  • mic → PCM16 16k (Worklet) │          │  • verifies CU3E session JWT │        │  + avatar_config     │
 │  • camera → JPEG 1 fps       │ ◄─────── │  • opens Live session w/ SA  │ ◄───── │  (EU endpoint)       │
 │  • fMP4 → MediaSource <video>│  fMP4 +  │  • injects systemInstruction │  fMP4, │                      │
 │  • captions from transcripts │  events  │  • executes tool calls       │  tool  │                      │
 └──────────────────────────────┘          │  • session resumption        │  calls └──────────────────────┘
              ▲                            │  • minute metering → Supabase│
              │ POST /api/avatar-session   └──────────────────────────────┘
 ┌──────────────────────────────┐                     │
 │ Next.js on Vercel            │  builds prompt ─────┘ (signed, 60 s TTL)
 │  /api/avatar-session         │
 │  /api/voice-save (reuse)     │
 │  /api/grade-session (reuse)  │
 └──────────────────────────────┘
```

### 4.1 Why a relay (and why not on Vercel)
- Vertex/Enterprise **has no ephemeral tokens for browsers** (js-genai #766). A service-account credential must never reach the tablet.
- Vercel functions can't hold long-lived bidirectional WebSockets. So: a small **Node relay on Google Cloud Run** (WebSockets supported, 60-min request timeout, same cloud as the model, and `europe-west` is the closest EU region to SA).
- The relay is thin. It authenticates, opens the Gemini session with the server-built config, pipes bytes both ways, runs tool calls against Supabase, and meters minutes.

### 4.2 Session bootstrap: `/api/avatar-session` (new, mirrors `voice-session`)
1. Supabase auth + child ownership check (copy from `voice-session`).
2. Eligibility check (parent flag, budget, plan tier).
3. Build **`systemInstruction`** by extracting the prompt builder out of `voice-llm` into a shared `src/lib/echo-prompt.ts`: language directive, age band, memory brief, active curriculum text (budget ~20–40k tokens, trimmed), mode rules, safety rules, avatar-specific rules (for example "keep turns under 3 sentences; you are on camera").
4. Mint a **short-lived signed relay ticket** (JWT, 60 s, contains `childId`, `parentId`, `mode`, `lang`, `avatar`, prompt hash). Store the full prompt in Supabase (or Redis) keyed by ticket, so no large prompt ever travels through the client.
5. Return `{ relayUrl, ticket, fallback: 'elevenlabs' | null }`.

### 4.3 Live connect config (relay side, sketch)
```ts
const session = await ai.live.connect({
  model: 'gemini-3.8-live',
  config: {
    responseModalities: ['AUDIO'],            // avatar video rides on top
    systemInstruction: { parts: [{ text: prompt }] },
    avatarConfig: {
      avatarName: child.avatarPreset ?? 'Kai',  // preset during pilot
      // customizedAvatar: { imageMimeType: 'image/png', imageData: ECHO_9x16 } // after allowlist
    },
    speechConfig: { languageCode: bcp47(child.lang) }, // en-ZA / af-ZA / zu-ZA (verify)
    inputAudioTranscription: {},              // → captions + voice-save + grading
    outputAudioTranscription: {},
    realtimeInputConfig: { automaticActivityDetection: {} }, // server VAD
    sessionResumption: { handle: resumeHandle },
    contextWindowCompression: { slidingWindow: {} },
    tools: [{ functionDeclarations: ECHO_TOOLS }],
  },
  callbacks: { onmessage: pipeToClient, onclose: meterAndClose },
});
```
*(Field names follow the `@google/genai` ≥ 2.3 camelCase convention. Confirm them against the "Configure live avatars" doc in the spike.)*

### 4.4 Tools Echo gets (non-blocking where possible)
| Tool | Purpose | Replaces |
|---|---|---|
| `get_worksheet(page?)` | Pull more of the active curriculum doc on demand instead of stuffing the prompt | Curriculum injection in `voice-llm` |
| `log_breakthrough(topic, evidence)` | Writes to the grading/notifications pipeline mid-session | Post-hoc grader only |
| `mark_curriculum_progress(pack, item)` | Updates `curriculum_progress` | Same |
| `show_on_screen(kind, payload)` | Pushes a sum, word or image card to the UI next to the face | New |
| `end_session(reason)` | Clean close on sleep intent | Regex sleep detection |
| `generate_story_image(prompt)` | Storybook scenes (Phase 4) | `/api/story-image` |

### 4.5 Client: `AvatarTalk.tsx` (new sibling of `VoiceTalk.tsx`)
- **Mic:** `getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })` → AudioWorklet → Int16 PCM @ 16 kHz → 20–40 ms chunks → relay.
- **Video out:** `MediaSource` (or `ManagedMediaSource` on iPadOS 17+) with a `SourceBuffer` for `video/mp4; codecs="avc1.42E01E, mp4a.40.2"`. Append fMP4 fragments; trim the buffer behind `currentTime` to cap memory. Autoplay requires the tap that opened the overlay; reuse it to call `video.play()`.
- **Barge-in:** when server VAD reports the child interrupting (`interrupted: true`), flush the SourceBuffer and jump to live edge so Echo stops mid-word.
- **Captions:** render `outputTranscription` under the face (a literacy win for little kids), and push both transcripts into `turnsRef` so the **existing `/api/voice-save` → `/api/grade-session` pipeline works unchanged**.
- **Camera (Homework lens):** optional toggle, 1 fps JPEG at ~640 px on the long edge, only while toggled on, with a visible "Echo can see" indicator.
- **Port over:** the 45 s silence auto-end, sleep intent (now also via the `end_session` tool), Esc to close, wake-lock, flush on disconnect.
- **Resilience:** on `goAway` / connection close, reconnect with `sessionResumption.handle` behind a 1-second "Echo blinked" loading state. If it fails twice, fall back to the EL voice overlay and carry the transcript over.

### 4.6 Data model (new migration `020_live_avatar.sql`)
```sql
alter table children add column avatar_enabled boolean not null default false;
alter table children add column avatar_daily_minutes int not null default 15;
create table avatar_sessions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid references children(id) on delete cascade,
  started_at timestamptz default now(),
  ended_at timestamptz,
  speaking_seconds int default 0,     -- billable avatar seconds
  input_audio_seconds int default 0,
  camera_used boolean default false,
  resumptions int default 0,
  end_reason text,
  est_cost_usd numeric(8,4)
);
-- RLS: parent can read own children's rows; relay writes with service role
```

---

## 5. Cost and bandwidth model

### 5.1 Cost per 10-minute tutor session (assumptions: Echo speaks 40%, child 45%, silence 15%)
| Component | Calc | USD |
|---|---|---|
| Avatar video out | 4 min × $0.37 | 1.48 |
| Audio out | 4 min × ~$0.018 | 0.07 |
| Audio in | 10 min streamed (~32 tokens/sec est.) → ~19k tokens × $3/M | 0.06 |
| Context re-processing | 30 turns × ~25k-token prompt × $0.75/M (text in, less with caching) | ≈ 0.30–0.55 |
| **Total** | | **≈ $1.90–2.20 / 10 min (≈ R34–40)** |
| *Today: EL ConvAI* | *~$0.08/min × 10* | *≈ $0.80* |
| *Target: unbundled EL (TODO)* | | *≈ $0.20–0.40* |

**Implication:** at a R250/month subscription, a child using the avatar 10 min/day would cost ~R1,000+/month. So the avatar **must be minute-capped and/or sold as a premium tier**. Suggested: **15 avatar-min/day on a "CU3E Plus" tier (~R399–R449/month)**, with unlimited audio-only Echo on the base tier. Re-price once the spike yields measured token counts.

**Cost levers:** shorter Echo turns (you pay only while the avatar speaks); context caching on the static prompt; `get_worksheet` tool instead of stuffing the curriculum; an avatar "idle loop" (client-side looping clip) during listening; drop to audio-only after N minutes.

### 5.2 Bandwidth
- Downlink: an H.264 talking head at mobile resolution is likely ~300–800 kbps while speaking (**measure in spike**), versus ~50–100 kbps for EL audio.
- A 10-min session ≈ **15–40 MB**. Fine on home Wi-Fi, too heavy for prepaid Phase 2 bundles, which confirms the Wi-Fi/4G-only gate.

---

## 6. Safety, privacy and compliance (Gate 0, blocks everything)

1. **Terms for under-18 audiences.** Gemini API terms explicitly forbid under-18 apps; they don't govern Google Cloud. **Get written confirmation** from a Google Cloud rep (you'll be talking to them anyway for the allowlist) that Gemini Enterprise / Live Avatar may be used in a **child-directed education product**, and on what conditions (parental consent, human-in-loop, and so on).
2. **Fix the existing exposure.** `story-image` and `skill-images/seed` use `@ai-sdk/google` with a Gemini API (AI Studio) key. Move them to the **Vertex provider (`@ai-sdk/google-vertex`)** on the same GCP project. It's a small change.
3. **POPIA (SA):** children's data is special personal information and needs a **competent person's (parent's) prior consent**. Add explicit consent screens for (a) voice/face-to-face AI and (b) camera use. Update `/privacy` to name Google Cloud as an operator, EU data processing and SynthID. The data-residency choice is **EU endpoint**; document the cross-border transfer basis.
4. **Camera:** off by default, per-session toggle, visible indicator, no frames stored, no face data retained. Instruct Echo in the system prompt to never comment on the child's appearance or surroundings, only the work.
5. **Content safety:** port all `voice-llm` guardrails, set Gemini safety settings to strictest, and add a server-side transcript scan (existing grader + keyword flags). Anything flagged notifies the parent through the existing notifications pipeline.
6. **Transparency:** "Echo is an AI" copy stays on screen; SynthID is already embedded in every stream.
7. **Wellbeing:** daily minute caps (also a cost control), no "streak pressure", and keep the 45 s auto-sleep and sleep intent.
8. **Custom avatar rights:** Echo is CU3E's own IP, so the likeness is clean. The allowlist also needs an **audio sample**; use a licensed/owned voice, not the EL voice, unless the licence allows it.

---

## 7. Delivery plan

### Phase 0: Legal and access (week 0–1, in parallel with Phase 1)
- [ ] Create or choose a GCP project and enable the Gemini Enterprise Agent Platform. Request quota for `gemini-3.8-live` in `europe-west4`.
- [ ] Contact Google Cloud sales: (a) child-directed-use confirmation, (b) **custom avatar allowlist application** for Echo, (c) pricing confirmation and startup credits (Google for Startups Cloud Program).
- [ ] Commission the 9:16 Echo portrait plus a 30–60 s owned voice sample.
- [ ] Move Nano Banana routes from the Gemini API key to Vertex.
- **Gate 0:** written OK from Google for the child audience. **No kids touch it before this.**

### Phase 1: Technical spike (week 1, ~4–5 dev days, adults only)
- [ ] Node script: connect to `gemini-3.8-live` with a **preset avatar** and dump the raw fMP4 to disk. Confirm field names, fragment cadence, resolution/fps, and bitrate.
- [ ] Minimal HTML page: MSE playback, mic in, measure **time-to-first-frame** and **turn latency** on a Wi-Fi iPad, an Android tablet and a laptop.
- [ ] Language test: the same tutoring script in **en-ZA, Afrikaans, isiZulu**. Rate STT accuracy, TTS naturalness and lip-sync. *(If af/zu pass, this alone could retire the Fiverr voice-clone plan in TODO.md.)*
- [ ] Measure real token counts → verify the $/min model in §5.
- [ ] Test the resumption handover at ~10 min.
- **Gate 1 (quality and cost):** p50 turn latency < 1.2 s; af or zu quality ≥ the EL baseline; measured cost within ±30% of the model. Go / no-go.

### Phase 2: Relay and prompt port (weeks 2–3)
- [ ] Extract `src/lib/echo-prompt.ts` from `voice-llm` (shared by EL and Gemini paths, which avoids prompt drift).
- [ ] Build `cu3e-live-relay` on Cloud Run: ticket verification, Gemini connect, bidirectional pipe, tool executor, metering, resumption.
- [ ] `/api/avatar-session` route plus migration `020_live_avatar.sql`.
- [ ] Tool implementations (§4.4) against Supabase with the service role.

### Phase 3: Client and internal beta (weeks 3–4)
- [ ] `AvatarTalk.tsx` (MSE player, AudioWorklet mic, captions, barge-in, camera lens, fallback to `VoiceTalk`).
- [ ] Eligibility gate plus parent toggle in the dashboard (next to `ChildLanguagePicker`).
- [ ] Transcript → `voice-save` → `grade-session` → memory refresh (reuse).
- [ ] **Family beta** (Tatum + Ella), preset avatar, English, Tutor mode only, 10 min/day cap. Collect: engagement minutes vs voice-only, "would you rather" preference, parent comfort, any fear/uncanny reactions (especially the 6-year-old).

### Phase 4: Echo's own face and more modes (weeks 5–8, dependent on allowlist)
- [ ] Swap in the custom Echo owl avatar. Run a side-by-side test against the preset with both kids.
- [ ] Turn on af/zu for avatar sessions if Gate 1 passed.
- [ ] Reading mode (Echo listens to reading aloud, visibly nods and reacts) and Storybook narrator.
- [ ] `show_on_screen` cards (sums, spelling words) beside the face.

### Phase 5: Commercial launch (after concept validation)
- [ ] "CU3E Plus" tier with an avatar minute allowance; update `/pricing` and the homepage modes.
- [ ] Marketing assets: record demo sessions (with consent) for the homepage hero.
- [ ] Monitoring dashboard: avatar minutes, cost per child, fallback rate, resumption failures, latency.

**Effort estimate:** ~4–6 dev-weeks to a family beta; ~8 weeks to a custom-Echo avatar in production. The allowlist turnaround is the main schedule risk.

---

## 8. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Google won't sanction child-directed use | Med | Fatal | Gate 0 before build; fall back to a client-side animated owl (Rive/Lottie lip-sync from EL audio visemes) as "Plan B face" |
| Allowlist denied or slow | Med | High | Preset for beta; Plan B face; re-apply with an education use-case pack |
| Owl doesn't lip-sync well (non-human) | Med | Med | Test during allowlist; a more anthropomorphic Echo portrait variant; Plan B |
| Cost overrun | High | High | Hard daily caps in the relay; short-turn prompt; premium tier; monthly spend alert in GCP |
| Latency from SA to the EU endpoint | Med | Med | Measure in spike; `europe-west` region; keep turns short |
| iPad Safari MSE quirks | Med | Med | `ManagedMediaSource` path; test iPadOS 17/18; fall back to audio |
| Session cut at a few minutes | High | Med | Resumption + compression; a natural "Echo blink" transition |
| Uncanny or scary for young kids | Med | High | Stylised owl only for ≤9; parent opt-in; watch beta reactions |
| Prompt drift between EL and Gemini brains | High | Med | Single `echo-prompt.ts` source of truth |
| Vendor lock-in / preview churn | Med | Med | Keep EL path live; the relay abstracts the provider |

---

## 9. Plan B (keep in the back pocket)
If Gate 0 or Gate 1 fails, you can still get most of the "Echo has a face" magic much more cheaply. Use a **client-side animated Echo** (Rive state machine: idle, listen, talk, think, happy) driven by audio amplitude or EL alignment timestamps. There's no per-minute video cost, it runs offline, it works on 3G, and it suits the Phase 2 tablet. It could even be the default for all users, with Gemini Live Avatar reserved as the premium tier.

---

## 10. Immediate next steps (this week)
1. Email Google Cloud sales: child-use confirmation, avatar allowlist, credits.
2. Generate the 9:16 Echo portrait (Higgsfield / Nano Banana).
3. Stand up the GCP project and run the Phase 1 spike script with a preset avatar.
4. Move the Nano Banana image routes off the AI Studio key.

---

### Sources
- [Introducing Gemini 3.8 Live with Live Avatar (Google blog)](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-8-live-with-live-avatar/)
- [Gemini 3.8 Live with Live Avatar is now GA (Google Cloud blog)](https://cloud.google.com/blog/products/ai-machine-learning/gemini-3-8-live-with-live-avatar-is-now-generally-available)
- [Configure live avatars (Google Cloud docs)](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/live-api/configure-live-avatars)
- [Developer's guide to Gemini 3.8 Live (Google Cloud docs)](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/guides/gemini-3-8-live)
- [gemini-live-api-dev skill (google-gemini/gemini-skills)](https://github.com/google-gemini/gemini-skills/blob/main/skills/gemini-live-api-dev/SKILL.md)
- [LiteLLM issue #43166: avatar_config / customized_avatar details](https://github.com/BerriAI/litellm/issues/43166)
- [js-genai issue #766: no ephemeral tokens on Vertex](https://github.com/googleapis/js-genai/issues/766)
- [Choosely: limits and pricing analysis](https://choosely.ai/ai-radar/gemini-3-8-live-avatar-explained)
- [note.com: pricing table and avatar limits](https://note.com/allegro_ai/n/n9d7972e56088?hl=en)
- [Engadget coverage](https://www.engadget.com/2268587/google-video-avatars-gemini-3-8-live-agent/)
- [Gemini API Additional Terms (under-18 clause)](https://ai.google.dev/gemini-api/terms)
