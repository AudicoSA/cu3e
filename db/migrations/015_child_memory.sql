-- ============================================================
-- 015 — child memory brief
-- "Echo Remembers": each child gets a small running brief of who
-- they are, what they've been working on, what they got stuck on,
-- in-jokes, favourite topics. Refreshed by a cheap Haiku summariser
-- after sessions (debounced so it runs at most ~daily). Injected
-- into the system prompt of /api/chat and the dynamic variables of
-- /api/voice-session so every conversation continues from where
-- the relationship left off.
--
-- HOW TO APPLY: paste into Supabase Studio → SQL Editor → Run.
-- Idempotent.
-- ============================================================

alter table public.children
  add column if not exists memory_brief text;

alter table public.children
  add column if not exists memory_updated_at timestamptz;
