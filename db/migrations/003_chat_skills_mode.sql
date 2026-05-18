-- ============================================================
-- 003 — chat_messages.mode adds 'skills'
-- AI Skills lessons (Five Big Ideas from AI4K12) are their own
-- mode so the dashboard can tell them apart from Tutor / Storybook.
--
-- HOW TO APPLY: paste into Supabase Studio → SQL Editor → Run.
-- Idempotent.
-- ============================================================

alter table public.chat_messages
  drop constraint if exists chat_messages_mode_check;

alter table public.chat_messages
  add constraint chat_messages_mode_check
  check (mode in ('tutor', 'storybook', 'skills'));
