-- ============================================================
-- 016 — chat_messages.mode adds 'reading'
-- Reading-aloud mode: kid reads a passage aloud (via voice-augment),
-- Echo coaches pronunciation, asks comprehension questions, tracks
-- which words were misread or skipped. Persisted as chat_messages
-- with mode='reading' so it shows up on the parent dashboard's
-- mode-breakdown donut like the other four.
--
-- HOW TO APPLY: paste into Supabase Studio → SQL Editor → Run.
-- Idempotent.
-- ============================================================

alter table public.chat_messages
  drop constraint if exists chat_messages_mode_check;

alter table public.chat_messages
  add constraint chat_messages_mode_check
  check (mode in ('tutor', 'storybook', 'skills', 'voice', 'reading'));
