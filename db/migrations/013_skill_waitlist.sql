-- ============================================================
-- 013 — skill_waitlist
-- Captures parent interest when they tap a 'coming soon' AI Skills
-- tile. We use this to (a) prioritise which modules to build next
-- and (b) email people when their requested lesson is ready.
--
-- HOW TO APPLY: paste this whole file into Supabase Studio →
--   SQL Editor → New query → Run.
-- Idempotent — safe to re-run.
-- ============================================================

create table if not exists public.skill_waitlist (
  id uuid primary key default gen_random_uuid(),
  -- Nullable so logged-out browsers can still register interest. When the
  -- parent is signed in we link to their auth.users row for follow-up.
  parent_id uuid references auth.users(id) on delete set null,
  email text not null,
  lesson_id text not null,
  -- Optional free-text reason ("My daughter is desperate to try HeyGen").
  note text,
  created_at timestamptz not null default now(),
  unique (email, lesson_id)
);

create index if not exists skill_waitlist_lesson_idx
  on public.skill_waitlist (lesson_id, created_at desc);
create index if not exists skill_waitlist_parent_idx
  on public.skill_waitlist (parent_id, created_at desc);

-- ============================================================
-- Row Level Security
-- The /api/skill-waitlist route runs with the user's session when one
-- exists; we also allow anon inserts so a parent who lands on /skills
-- without an account can still register interest.
-- ============================================================
alter table public.skill_waitlist enable row level security;

drop policy if exists "anyone can insert waitlist" on public.skill_waitlist;
create policy "anyone can insert waitlist"
  on public.skill_waitlist for insert
  to anon, authenticated
  with check (true);

drop policy if exists "parents read own waitlist" on public.skill_waitlist;
create policy "parents read own waitlist"
  on public.skill_waitlist for select
  to authenticated
  using (parent_id = auth.uid());
