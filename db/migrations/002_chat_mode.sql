-- ============================================================
-- 002 — chat_messages.mode
-- Distinguishes Tutor sessions (homework help, Socratic) from
-- Storybook sessions (Layer 2 creative co-writing) and any future
-- modes we add.
--
-- HOW TO APPLY: paste into Supabase Studio → SQL Editor → Run.
-- Idempotent: safe to re-run.
-- ============================================================

alter table public.chat_messages
  add column if not exists mode text not null default 'tutor'
    check (mode in ('tutor', 'storybook'));

create index if not exists chat_messages_parent_mode_recent_idx
  on public.chat_messages (parent_id, mode, created_at desc);
