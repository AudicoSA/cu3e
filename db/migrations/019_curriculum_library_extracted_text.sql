-- ============================================================
-- 019 — curriculum_library extracted_text + question_count
-- Library packs now ship with the worksheet text + question count
-- pre-baked, so when a parent one-click activates a pack the kid's
-- curriculum_documents row gets both fields copied immediately. No
-- per-activation Claude vision call (saves money, makes voice mode
-- work the moment the pack is activated, removes the 10-30s wait).
--
-- For parent-uploaded PDFs / photos the existing flow is unchanged:
-- /api/extract-pdf still runs after upload and populates the same
-- two fields on curriculum_documents.
--
-- HOW TO APPLY: paste into Supabase Studio → SQL Editor → Run.
-- Idempotent.
-- ============================================================

alter table public.curriculum_library
  add column if not exists extracted_text text;

alter table public.curriculum_library
  add column if not exists question_count integer;
