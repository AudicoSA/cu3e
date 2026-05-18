-- ============================================================
-- 009 — curriculum_progress
-- One row per (child × curriculum_document × question_label) the child has
-- answered correctly during a chat. Driven by a small Claude-Haiku grader
-- call that runs after each child reply in the chat route.
--
-- ALSO: add `question_count` to curriculum_documents so the progress bar
-- knows what 100% looks like for each PDF (counted from extracted_text at
-- extraction time).
--
-- HOW TO APPLY: paste this whole file into Supabase Studio → SQL Editor.
-- Idempotent: safe to re-run.
-- ============================================================

alter table public.curriculum_documents
  add column if not exists question_count int;

create table if not exists public.curriculum_progress (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  parent_id uuid not null references auth.users(id) on delete cascade,
  curriculum_document_id uuid not null references public.curriculum_documents(id) on delete cascade,
  question_label text not null,
  conversation_id uuid,
  answered_at timestamptz not null default now(),
  unique (child_id, curriculum_document_id, question_label)
);

create index if not exists curriculum_progress_child_doc_idx
  on public.curriculum_progress (child_id, curriculum_document_id);

alter table public.curriculum_progress enable row level security;

drop policy if exists "parents read own progress" on public.curriculum_progress;
create policy "parents read own progress"
  on public.curriculum_progress for select
  using (parent_id = auth.uid());

-- Server-side inserts via service-role only; clients never write directly.
-- (No insert policy = blocked under RLS for anon/authed.)
