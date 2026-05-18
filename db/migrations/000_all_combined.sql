-- ============================================================
-- COMBINED migration — runs 001 + 002 + 003 as one transaction.
-- Safe to re-run.
-- Paste into Supabase Studio → SQL Editor → Run.
-- ============================================================

-- 001: chat_messages table
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

alter table public.chat_messages enable row level security;

drop policy if exists "parents read own messages" on public.chat_messages;
create policy "parents read own messages"
  on public.chat_messages for select
  using (parent_id = auth.uid());

drop policy if exists "parents insert own messages" on public.chat_messages;
create policy "parents insert own messages"
  on public.chat_messages for insert
  with check (parent_id = auth.uid());

drop policy if exists "parents delete own messages" on public.chat_messages;
create policy "parents delete own messages"
  on public.chat_messages for delete
  using (parent_id = auth.uid());

-- 002 + 003: mode column with all three values allowed
alter table public.chat_messages
  add column if not exists mode text not null default 'tutor';

alter table public.chat_messages
  drop constraint if exists chat_messages_mode_check;

alter table public.chat_messages
  add constraint chat_messages_mode_check
  check (mode in ('tutor', 'storybook', 'skills'));

create index if not exists chat_messages_parent_mode_recent_idx
  on public.chat_messages (parent_id, mode, created_at desc);
