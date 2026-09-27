# CU3E codebase overview

Snapshot of `github.com/AudicoSA/cu3e` (main, 27 Sep 2026). 126 tracked files.

## Stack
- Next.js 16.2.6 (App Router; AGENTS.md warns APIs differ from older Next, check `node_modules/next/dist/docs/`), React 19.2, Tailwind 4, TypeScript
- Supabase (auth, Postgres, storage). Project ref `gpwymgtgtfcxlniptpzh`. Migrations 000–019 in `db/migrations/`
- Vercel hosting (`cu3e-hazel.vercel.app`); cron `/api/voice-sync` every 15 min
- AI: Vercel AI SDK v6. Anthropic (chat, Haiku for memory/opener), OpenAI gpt-4o-mini (voice brain), Google `gemini-2.5-flash-image` (story/skill images), ElevenLabs Conversational AI + TTS (Echo's voice)

## Product surfaces
- `/study-hub`: the child's app. Modes: **tutor, storybook, skills, reading**. Voice FAB, wake word "Echo", screensaver, camera worksheet capture
- `/dashboard`: parent view (children, analytics, curriculum progress, weekly overview audio, notifications, language picker)
- `/skills` (AI Skills, 50 modules), `/parents`, `/pricing`, marketing homepage

## Key API routes
| Route | Role |
|---|---|
| `api/chat` | Text chat (all modes), system prompt build, memory + curriculum injection |
| `api/voice-session` | Mints EL signed URL + dynamic vars + Haiku opener |
| `api/voice-llm/[[...path]]` | Custom LLM for EL agent → proxies to OpenAI with CU3E prompt |
| `api/voice-save`, `api/voice-sync`, `api/voice-webhook` | Persist voice transcripts |
| `api/grade-session` | Grades sessions → breakthroughs / notifications |
| `api/refresh-memory` | Rebuilds `children.memory_brief` |
| `api/extract-pdf`, `api/library/promote` | Curriculum docs + CAPS library |
| `api/story-image`, `api/skill-images/seed` | Nano Banana images |
| `api/weekly-overview/generate` | Sunday parent briefing (EL TTS) |

## Content
- CAPS curriculum seeds: 263 packs across 9 subjects (`scripts/seed_caps_*.py`)
- Languages: en / af / zu (`src/lib/languages.ts`); native af/zu voices still an open problem

## Open work (from TODO.md)
- Rotate leaked API keys; set up partnerships@ mailbox; point cu3e.co.za at Vercel
- Unbundle EL ConvAI → direct TTS + STT (cost + Phase 2 bandwidth gate)
- Voice minute budget; memory time-decay
- Native af/zu voices (Fiverr voice clone plan)
- Phase 2: locked-down Android rental tablet (kiosk APK, provisioning, offline, low-data mode)
