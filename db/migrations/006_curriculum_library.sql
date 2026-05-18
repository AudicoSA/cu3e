-- ============================================================
-- 006 — curriculum_library
-- A shared catalog of pre-curated curriculum PDFs that parents
-- can one-click attach to their child without finding their own.
--
-- Activation flow:
--   Parent clicks "Add to Tatum's hub" on a library pack →
--   we INSERT a row into curriculum_documents pointing at the SAME
--   storage_path. Storage stays single-sourced; only metadata copied.
--
-- HOW TO APPLY: paste into Supabase Studio → SQL Editor → Run.
-- Idempotent.
-- ============================================================

create table if not exists public.curriculum_library (
  id uuid primary key default gen_random_uuid(),
  region text not null check (region in ('CAPS', 'CommonCore', 'GCSE', 'IB', 'Other')),
  grade text,                        -- 'Grade 7', '5th Grade', 'Year 9', 'PYP-4'…
  subject text not null,             -- 'Mathematics', 'Natural Sciences', etc
  title text not null,               -- 'Patterns & Sequences'
  description text,                  -- one-line summary for the card
  storage_path text not null,        -- path inside the existing "curriculum" bucket, e.g. library/<id>.pdf
  source_attribution text,           -- 'HomeworkHelp 365 notes', 'CCSSO public', etc
  page_count integer,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists curriculum_library_region_idx
  on public.curriculum_library (region, subject, grade)
  where is_published = true;

-- RLS — anyone authenticated can BROWSE the library
alter table public.curriculum_library enable row level security;

drop policy if exists "authenticated read published library" on public.curriculum_library;
create policy "authenticated read published library"
  on public.curriculum_library for select
  to authenticated
  using (is_published = true);

-- (No insert/update/delete policies — library is admin-managed via direct SQL or future admin UI.)

-- ============================================================
-- Storage policy: allow authenticated users to READ files under
-- the "library/" prefix in the existing "curriculum" bucket.
-- Each parent's own uploads still live under "<childId>-<ts>.pdf"
-- and use whatever policies you already have.
-- ============================================================

drop policy if exists "authenticated read library files" on storage.objects;
create policy "authenticated read library files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'curriculum'
    and (storage.foldername(name))[1] = 'library'
  );

-- ============================================================
-- SEED DATA (one example so the UI isn't empty on launch)
-- The actual PDF file needs to be uploaded separately to:
--   curriculum/library/grade-7-maths-patterns.pdf
-- in the Supabase Storage UI. Update the storage_path here if
-- you upload it under a different name.
-- ============================================================

insert into public.curriculum_library (
  region, grade, subject, title, description,
  storage_path, source_attribution, page_count
) values (
  'CAPS', 'Grade 7', 'Mathematics',
  'Patterns & Sequences',
  'Numeric and geometric patterns. The same worksheet Echo demos on the homepage.',
  'library/grade-7-maths-patterns.pdf',
  'HomeworkHelp 365 notes',
  1
) on conflict do nothing;

insert into public.curriculum_library (
  region, grade, subject, title, description,
  storage_path, source_attribution
) values (
  'CommonCore', '5th Grade', 'Mathematics',
  'Fractions: addition with unlike denominators',
  'Common Core 5.NF.A.1 — add fractions with different denominators using equivalent fractions.',
  'library/cc-grade-5-fractions.pdf',
  'CCSSO public materials'
) on conflict do nothing;

insert into public.curriculum_library (
  region, grade, subject, title, description,
  storage_path, source_attribution
) values (
  'GCSE', 'Year 9', 'Science',
  'Forces, motion & energy transfer',
  'Newton''s laws, kinetic vs potential energy, simple worked examples.',
  'library/gcse-year-9-forces.pdf',
  'OpenSTAX equivalent'
) on conflict do nothing;
