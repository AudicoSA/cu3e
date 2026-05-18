-- ============================================================
-- 004 — weekly_overviews
-- Stores generated parent-facing weekly digests:
--   - text transcript (from Claude)
--   - audio URL (from ElevenLabs, stored in Supabase Storage)
--   - period covered + message counts for visibility
--
-- HOW TO APPLY: paste into Supabase Studio → SQL Editor → Run.
-- Idempotent.
-- ============================================================

create table if not exists public.weekly_overviews (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  transcript text not null,
  audio_storage_path text,             -- path inside the "overviews" storage bucket
  message_count integer not null default 0,
  generated_at timestamptz not null default now()
);

create index if not exists weekly_overviews_parent_recent_idx
  on public.weekly_overviews (parent_id, generated_at desc);

alter table public.weekly_overviews enable row level security;

drop policy if exists "parents read own overviews" on public.weekly_overviews;
create policy "parents read own overviews"
  on public.weekly_overviews for select
  using (parent_id = auth.uid());

drop policy if exists "parents insert own overviews" on public.weekly_overviews;
create policy "parents insert own overviews"
  on public.weekly_overviews for insert
  with check (parent_id = auth.uid());

drop policy if exists "parents delete own overviews" on public.weekly_overviews;
create policy "parents delete own overviews"
  on public.weekly_overviews for delete
  using (parent_id = auth.uid());

-- ============================================================
-- STORAGE BUCKET — run this part in Supabase Studio → Storage
-- if the bucket doesn't already exist:
--   1. Create a private bucket called "overviews"
--   2. Add a policy allowing authenticated users to SELECT/INSERT
--      objects where the path starts with their auth.uid()/
-- (Storage policies live separately from table RLS.)
-- ============================================================
