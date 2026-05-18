-- ============================================================
-- 001 — chat_messages
-- Stores every Echo conversation turn for a child.
--
-- HOW TO APPLY: paste this whole file into Supabase Studio
--   → SQL Editor → New query → Run.
-- Idempotent: safe to re-run.
--
-- POPIA / GDPR note: this table holds personal data of minors.
-- Retention plan: messages are deleted automatically when the
-- parent or child row is deleted (ON DELETE CASCADE). If you
-- later need a hard cutoff (e.g. 12 months), add a scheduled
-- delete via Supabase Cron.
-- ============================================================

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  parent_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  flagged boolean not null default false,
  flag_reason text,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_child_recent_idx
  on public.chat_messages (child_id, created_at desc);

create index if not exists chat_messages_conversation_idx
  on public.chat_messages (conversation_id, created_at);

create index if not exists chat_messages_parent_recent_idx
  on public.chat_messages (parent_id, created_at desc);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.chat_messages enable row level security;

-- Parents can read messages belonging to them
drop policy if exists "parents read own messages" on public.chat_messages;
create policy "parents read own messages"
  on public.chat_messages for select
  using (parent_id = auth.uid());

-- Server-side inserts (the chat route runs with the user's session)
drop policy if exists "parents insert own messages" on public.chat_messages;
create policy "parents insert own messages"
  on public.chat_messages for insert
  with check (parent_id = auth.uid());

-- Parents can delete their own messages (for export/erasure requests)
drop policy if exists "parents delete own messages" on public.chat_messages;
create policy "parents delete own messages"
  on public.chat_messages for delete
  using (parent_id = auth.uid());
