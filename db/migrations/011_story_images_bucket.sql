-- ============================================================
-- 011 — story_images bucket + read policy
-- Storybook scene illustrations were base64 data URLs that vanished
-- when the user closed the tab. We now persist each one to Supabase
-- Storage at `story-images/<parent_id>/<conversation_id>/<ts>.png` so
-- kids can revisit illustrated stories later (gallery view TBD).
--
-- HOW TO APPLY: paste this whole file into Supabase Studio →
--   1) Storage → New bucket → name: 'story-images', public: OFF
--   2) SQL Editor → paste the policies below → Run
-- Idempotent — safe to re-run.
-- ============================================================

-- The bucket itself must be created via the Storage UI first (or via the
-- management API). The policy below assumes it exists.

-- Parents can READ files under their own parent_id/ folder.
drop policy if exists "parents read own story images" on storage.objects;
create policy "parents read own story images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'story-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Server-side inserts only (the /api/story-image route uses service-role).
-- No client-side write policy — anon and authed are blocked.
