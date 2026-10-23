-- DRAFT — NOT FOR APPLICATION WITHOUT APPROVAL
-- Member-owned Signal conversation threads (server sync). Device-local storage ships first in mobile v1.

create table if not exists public.signal_conversation_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists signal_conversation_threads_user_updated_idx
  on public.signal_conversation_threads (user_id, updated_at desc)
  where deleted_at is null;

create table if not exists public.signal_conversation_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.signal_conversation_threads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  -- Truncate at ingest; never store full credit/justice document payloads in chat.
  content text not null check (char_length(content) between 1 and 4000),
  intent text,
  model_assisted boolean not null default false,
  provenance jsonb,
  created_at timestamptz not null default now()
);

create index if not exists signal_conversation_messages_thread_created_idx
  on public.signal_conversation_messages (thread_id, created_at asc);

alter table public.signal_conversation_threads enable row level security;
alter table public.signal_conversation_messages enable row level security;

create policy signal_threads_owner on public.signal_conversation_threads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy signal_messages_owner on public.signal_conversation_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- RPCs (sketch): list_signal_threads, upsert_signal_thread, append_signal_message, soft_delete_signal_thread
