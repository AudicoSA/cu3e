-- ============================================================
-- 014 — skill-images bucket (public read)
-- Background tile imagery for /skills, generated once via Gemini
-- Nano Banana through /api/skill-images/seed. Public-read because
-- the tiles are part of the marketing surface; the bucket holds no
-- personal data — just stylised AI-generated illustrations keyed
-- by lesson id (e.g. story-images/perception.png).
--
-- HOW TO APPLY:
--   1) Storage → New bucket → name: 'skill-images', public: ON
--   2) SQL Editor → paste this file → Run
-- Idempotent — safe to re-run.
-- ============================================================

-- The bucket itself must be created via the Storage UI (or management API)
-- with public read enabled. The select policy below mirrors what Supabase
-- creates by default for public buckets; declared here so the migration
-- is the single source of truth.

drop policy if exists "anyone reads skill images" on storage.objects;
create policy "anyone reads skill images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'skill-images');

-- Server-side inserts only — /api/skill-images/seed uses service-role.
-- No client-side write policy.
