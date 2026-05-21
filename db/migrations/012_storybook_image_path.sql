-- ============================================================
-- 012 — storybook_image_path on chat_messages
-- Storybook scene images used to live only as base64 data URLs in
-- the in-memory React state — vanished on reload. Migration 011
-- added the `story-images` storage bucket; the route now uploads
-- there, but until this migration there was no way to link a
-- saved image back to the assistant message it illustrated.
--
-- Adding the column to chat_messages (rather than a side table)
-- keeps the model simple: at most one image per assistant turn.
-- On chat reload, we hand a signed URL to the client for every
-- message that has a non-null storybook_image_path.
--
-- HOW TO APPLY: paste this whole file into Supabase Studio →
--   SQL Editor → New query → Run.
-- Idempotent — safe to re-run.
-- ============================================================

alter table public.chat_messages
  add column if not exists storybook_image_path text;

-- No new index — we only ever read this column alongside the row
-- itself (via existing conversation/parent indexes).
