-- Chat feature pass: reactions, reply-quoting, message editing, photo
-- messages. Safe to run twice. Requires schema.sql + moderation.sql.

-- ---------------------------------------------------------------------------
-- Messages: reply threading, edit tracking, and an image kind.
-- ---------------------------------------------------------------------------

alter table public.messages
  add column if not exists reply_to_id bigint references public.messages(id) on delete set null;
alter table public.messages
  add column if not exists edited_at timestamptz;

alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages
  add constraint messages_kind_check check (kind in ('text', 'gif', 'system', 'image'));

-- Authors can edit their own messages. Coexists with "creators pin messages";
-- permissive policies OR together, so pinning is unaffected.
drop policy if exists "authors edit their messages" on public.messages;
create policy "authors edit their messages" on public.messages
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Reactions: one row per (message, user, emoji) — iMessage-style tapbacks.
-- ---------------------------------------------------------------------------

create table if not exists public.message_reactions (
  message_id bigint not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create index if not exists message_reactions_message on public.message_reactions (message_id);

alter table public.message_reactions enable row level security;

drop policy if exists "members read reactions" on public.message_reactions;
create policy "members read reactions" on public.message_reactions
  for select to authenticated using (
    exists (
      select 1
      from public.messages m
      join public.room_members rm on rm.room_id = m.room_id
      where m.id = message_reactions.message_id
        and rm.user_id = (select auth.uid())
    )
  );

drop policy if exists "members react as themselves" on public.message_reactions;
create policy "members react as themselves" on public.message_reactions
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.messages m
      join public.room_members rm on rm.room_id = m.room_id
      where m.id = message_reactions.message_id
        and rm.user_id = (select auth.uid())
    )
    and not exists (
      select 1 from public.user_bans b where b.user_id = (select auth.uid())
    )
  );

drop policy if exists "users remove their own reactions" on public.message_reactions;
create policy "users remove their own reactions" on public.message_reactions
  for delete to authenticated using (user_id = (select auth.uid()));

-- Realtime (idempotent — adding twice raises duplicate_object)
do $$
begin
  alter publication supabase_realtime add table public.message_reactions;
exception
  when duplicate_object then null;
end $$;
