-- ============================================================
-- 010 — chat_messages.mode adds 'voice'
-- Voice transcripts (ElevenLabs Conversational AI) get persisted into
-- chat_messages via a post-call webhook with mode='voice'. That way the
-- parent dashboard, weekly overview and AI grading all treat voice
-- convos as first-class — same shape as text Tutor/Storybook/Skills.
--
-- HOW TO APPLY: paste into Supabase Studio → SQL Editor → Run.
-- Idempotent.
-- ============================================================

alter table public.chat_messages
  drop constraint if exists chat_messages_mode_check;

alter table public.chat_messages
  add constraint chat_messages_mode_check
  check (mode in ('tutor', 'storybook', 'skills', 'voice'));
