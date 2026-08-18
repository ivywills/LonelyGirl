-- Room redesign feature pass: polls, voice notes, birthday/confetti moments,
-- and a room → playlist link. Safe to run twice. Requires schema.sql,
-- chat-features.sql, moderation.sql, playlists.sql.

-- ---------------------------------------------------------------------------
-- Messages: voice notes ('voice', content = storage URL) and system moments
-- ('moment', content = jsonb payload like {"type":"birthday","name":"Amara"}).
-- ---------------------------------------------------------------------------

alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages
  add constraint messages_kind_check check (kind in ('text', 'gif', 'system', 'image', 'voice', 'moment'));

alter table public.messages
  add column if not exists duration_secs int;

-- ---------------------------------------------------------------------------
-- Polls: any member can ask the room a question with 2–4 options.
-- ---------------------------------------------------------------------------

create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  creator_id uuid not null references auth.users(id) on delete cascade,
  creator_name text not null default '',
  question text not null check (char_length(question) between 1 and 200),
  options jsonb not null,
  closes_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists polls_room on public.polls (room_id, created_at);

alter table public.polls enable row level security;

drop policy if exists "members read polls" on public.polls;
create policy "members read polls" on public.polls
  for select to authenticated using (
    exists (
      select 1 from public.room_members m
      where m.room_id = polls.room_id and m.user_id = (select auth.uid())
    )
  );

drop policy if exists "members create polls" on public.polls;
create policy "members create polls" on public.polls
  for insert to authenticated with check (
    creator_id = (select auth.uid())
    and exists (
      select 1 from public.room_members m
      where m.room_id = polls.room_id and m.user_id = (select auth.uid())
    )
    and not exists (
      select 1 from public.user_bans b where b.user_id = (select auth.uid())
    )
  );

drop policy if exists "poll or room creators delete polls" on public.polls;
create policy "poll or room creators delete polls" on public.polls
  for delete to authenticated using (
    creator_id = (select auth.uid())
    or exists (
      select 1 from public.chat_rooms r
      where r.id = polls.room_id and r.creator_id = (select auth.uid())
    )
  );

-- One vote per person; changing your vote is delete + insert (or upsert).
create table if not exists public.poll_votes (
  poll_id uuid not null references public.polls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  option_idx int not null check (option_idx between 0 and 3),
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

alter table public.poll_votes enable row level security;

drop policy if exists "members read poll votes" on public.poll_votes;
create policy "members read poll votes" on public.poll_votes
  for select to authenticated using (
    exists (
      select 1
      from public.polls p
      join public.room_members m on m.room_id = p.room_id
      where p.id = poll_votes.poll_id and m.user_id = (select auth.uid())
    )
  );

drop policy if exists "members vote as themselves" on public.poll_votes;
create policy "members vote as themselves" on public.poll_votes
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.polls p
      join public.room_members m on m.room_id = p.room_id
      where p.id = poll_votes.poll_id
        and m.user_id = (select auth.uid())
        and (p.closes_at is null or p.closes_at > now())
    )
  );

drop policy if exists "voters change their vote" on public.poll_votes;
create policy "voters change their vote" on public.poll_votes
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "voters withdraw their vote" on public.poll_votes;
create policy "voters withdraw their vote" on public.poll_votes
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Moment cheers: the shared "confetti thrown" counter on a moment message.
-- ---------------------------------------------------------------------------

create table if not exists public.moment_cheers (
  moment_id bigint not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (moment_id, user_id)
);

alter table public.moment_cheers enable row level security;

drop policy if exists "members read cheers" on public.moment_cheers;
create policy "members read cheers" on public.moment_cheers
  for select to authenticated using (
    exists (
      select 1
      from public.messages m
      join public.room_members rm on rm.room_id = m.room_id
      where m.id = moment_cheers.moment_id and rm.user_id = (select auth.uid())
    )
  );

drop policy if exists "members cheer as themselves" on public.moment_cheers;
create policy "members cheer as themselves" on public.moment_cheers
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.messages m
      join public.room_members rm on rm.room_id = m.room_id
      where m.id = moment_cheers.moment_id and rm.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Room playlist: a room can point at one wall playlist for the room-life panel.
-- ---------------------------------------------------------------------------

alter table public.chat_rooms
  add column if not exists playlist_id uuid references public.playlists(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Voice note storage (same per-user pathing as room-images).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('voice-notes', 'voice-notes', true)
on conflict (id) do nothing;

drop policy if exists "voice notes are public" on storage.objects;
create policy "voice notes are public"
  on storage.objects for select
  using (bucket_id = 'voice-notes');

drop policy if exists "signed-in users upload voice notes" on storage.objects;
create policy "signed-in users upload voice notes"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'voice-notes');

-- ---------------------------------------------------------------------------
-- Realtime (idempotent — adding twice raises duplicate_object)
-- ---------------------------------------------------------------------------

do $$
begin
  alter publication supabase_realtime add table public.polls;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.poll_votes;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.moment_cheers;
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Admins can pin/unpin any message (the hover toolbar offers pinning to
-- admins as moderators; RLS previously only let room creators through).
-- Note: as a row-level update grant this also technically lets an admin edit
-- message content via the API — consistent with their delete powers.
-- ---------------------------------------------------------------------------

drop policy if exists "admins pin messages" on public.messages;
create policy "admins pin messages" on public.messages
  for update to authenticated using (public.is_admin());
