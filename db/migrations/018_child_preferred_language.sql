-- ============================================================
-- 018 — child preferred_language
-- Multilingual MVP: lets a parent set the language Echo should chat
-- in with each child. English ('en') is the default; Afrikaans ('af')
-- ships first per the strategic plan (Western Cape + private-school
-- Afrikaans-first families are an underserved premium segment, and
-- LLM quality in Afrikaans is near-English so it's a clean test of
-- the multilingual architecture before tackling Bantu languages).
--
-- The column stores ISO 639-1 codes so adding Zulu ('zu'), Xhosa
-- ('xh'), etc. later is purely a UI + system-prompt task.
--
-- HOW TO APPLY: paste into Supabase Studio → SQL Editor → Run.
-- Idempotent.
-- ============================================================

alter table public.children
  add column if not exists preferred_language text not null default 'en';

-- Soft constraint — keep the supported set explicit so a typo or
-- accidental write of an unsupported language code is caught early.
-- Drop + re-add so the check covers any future language additions
-- cleanly.
alter table public.children
  drop constraint if exists children_preferred_language_check;

alter table public.children
  add constraint children_preferred_language_check
  check (preferred_language in ('en', 'af', 'zu'));
