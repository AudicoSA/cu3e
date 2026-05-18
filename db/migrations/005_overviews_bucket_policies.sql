-- ============================================================
-- 005 — Storage policies for the "overviews" bucket
--
-- HOW TO APPLY: paste into Supabase Studio → SQL Editor → Run.
-- Prerequisite: the "overviews" bucket must already exist (Studio → Storage → New bucket, private).
-- Idempotent: drops existing policies of the same name first.
--
-- What these policies enforce:
--   Each parent's audio digests live under a folder named after their auth.uid().
--   The server route writes to "<auth.uid()>/<timestamp>.mp3".
--   Parents can read + write their own folder, nothing else.
--   No public/anon access. Audio is only ever served via short-lived signed URLs from the server.
-- ============================================================

-- Read own audio
drop policy if exists "parents read own overview audio" on storage.objects;
create policy "parents read own overview audio"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'overviews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Write own audio
drop policy if exists "parents insert own overview audio" on storage.objects;
create policy "parents insert own overview audio"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'overviews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Delete own audio (for parents who want to clear history)
drop policy if exists "parents delete own overview audio" on storage.objects;
create policy "parents delete own overview audio"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'overviews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
