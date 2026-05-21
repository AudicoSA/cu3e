-- ============================================================
-- 017 — parent_notifications
-- When a child's session is graded with a breakthrough >= 4 (or
-- another notable signal), we create a one-line notification the
-- parent sees on the dashboard. Email delivery comes later when
-- an email provider is wired in; for now this is in-app only.
--
-- Uniqueness on source_grade_id stops the breakthrough scanner
-- from creating duplicate notifications for the same graded
-- session if the scanner runs more than once.
--
-- HOW TO APPLY: paste into Supabase Studio → SQL Editor → Run.
-- Idempotent.
-- ============================================================

create table if not exists public.parent_notifications (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  kind text not null check (kind in ('breakthrough', 'milestone', 'streak')),
  title text not null,
  body text,
  source_grade_id uuid references public.session_grades(id) on delete set null,
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  dismissed_at timestamptz
);

-- One notification per graded session (when grade-backed).
create unique index if not exists parent_notifications_source_grade_uidx
  on public.parent_notifications (source_grade_id)
  where source_grade_id is not null;

create index if not exists parent_notifications_parent_recent_idx
  on public.parent_notifications (parent_id, created_at desc)
  where dismissed_at is null;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.parent_notifications enable row level security;

drop policy if exists "parents read own notifications" on public.parent_notifications;
create policy "parents read own notifications"
  on public.parent_notifications for select
  to authenticated
  using (parent_id = auth.uid());

drop policy if exists "parents update own notifications" on public.parent_notifications;
create policy "parents update own notifications"
  on public.parent_notifications for update
  to authenticated
  using (parent_id = auth.uid())
  with check (parent_id = auth.uid());

-- Inserts run from server-side scanners with service-role; no client insert policy.
