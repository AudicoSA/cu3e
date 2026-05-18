-- ============================================================
-- 007 — session_grades
-- One row per completed conversation. Claude grades each session
-- after it ends on three dimensions, 1-5 each. Surfaces "learning
-- quality" — not just volume — on the parent dashboard.
--
-- HOW TO APPLY: paste into Supabase Studio → SQL Editor → Run.
-- Idempotent.
-- ============================================================

create table if not exists public.session_grades (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  child_id uuid not null references public.children(id) on delete cascade,
  parent_id uuid not null references auth.users(id) on delete cascade,
  mode text not null,                              -- tutor / storybook / skills / voice
  persistence smallint not null check (persistence between 1 and 5),  -- did the kid stick with it?
  insight smallint not null check (insight between 1 and 5),          -- did real thinking happen?
  breakthrough smallint not null check (breakthrough between 1 and 5),-- moment of "aha"?
  summary text,                                    -- one-line takeaway from the session
  message_count integer not null default 0,
  graded_at timestamptz not null default now(),
  unique (conversation_id)                         -- one grade per conversation
);

create index if not exists session_grades_child_recent_idx
  on public.session_grades (child_id, graded_at desc);

create index if not exists session_grades_parent_recent_idx
  on public.session_grades (parent_id, graded_at desc);

alter table public.session_grades enable row level security;

-- Parents read their own kids' grades
drop policy if exists "parents read own grades" on public.session_grades;
create policy "parents read own grades"
  on public.session_grades for select
  using (parent_id = auth.uid());

-- Parents (via server route) insert their own kids' grades
drop policy if exists "parents insert own grades" on public.session_grades;
create policy "parents insert own grades"
  on public.session_grades for insert
  with check (parent_id = auth.uid());

drop policy if exists "parents delete own grades" on public.session_grades;
create policy "parents delete own grades"
  on public.session_grades for delete
  using (parent_id = auth.uid());
