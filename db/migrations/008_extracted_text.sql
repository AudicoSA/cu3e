-- ============================================================
-- 008 — curriculum_documents.extracted_text
-- Stores Claude-extracted verbatim text from each uploaded PDF so we
-- don't have to re-parse or re-vision-process the file on every chat
-- or voice turn. pdf-parse fails silently on scanned/image-only PDFs;
-- Claude Sonnet 4.6 reads them natively via vision.
--
-- HOW TO APPLY: paste this whole file into Supabase Studio
--   → SQL Editor → New query → Run.
-- Idempotent: safe to re-run.
-- ============================================================

alter table public.curriculum_documents
  add column if not exists extracted_text text,
  add column if not exists extracted_at timestamptz;

create index if not exists curriculum_documents_extracted_idx
  on public.curriculum_documents (id)
  where extracted_text is not null;
