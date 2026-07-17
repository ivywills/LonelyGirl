-- LonelyGirl chat schema. Run in Supabase SQL editor.

create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '',
  bg_color text not null default '#17171e',
  image_url text not null default '',
  tags text[] not null default '{}',
  is_private boolean not null default false,
  rules text not null default '',
  welcome_message text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.room_members (
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '',
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.join_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '',
  note text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','denied')),
  created_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '',
  content text not null check (char_length(content) <= 2000),
  kind text not null default 'text' check (kind in ('text','gif','system')),
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists messages_room_created on public.messages (room_id, created_at);

alter table public.chat_rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.join_requests enable row level security;
alter table public.messages enable row level security;

-- Rooms: any signed-in user can browse (private rooms are discoverable so people can request access)
create policy "rooms are viewable by signed-in users" on public.chat_rooms
  for select to authenticated using (true);
create policy "users create their own rooms" on public.chat_rooms
  for insert to authenticated with check (auth.uid() = creator_id);
create policy "creators update their rooms" on public.chat_rooms
  for update to authenticated using (auth.uid() = creator_id);
create policy "creators delete their rooms" on public.chat_rooms
  for delete to authenticated using (auth.uid() = creator_id);

-- Membership
create policy "memberships viewable by signed-in users" on public.room_members
  for select to authenticated using (true);
create policy "join public rooms, approved private rooms, or creator adds" on public.room_members
  for insert to authenticated with check (
    (
      user_id = auth.uid() and (
        exists (select 1 from public.chat_rooms r where r.id = room_id and (r.is_private = false or r.creator_id = auth.uid()))
        or exists (select 1 from public.join_requests q where q.room_id = room_members.room_id and q.user_id = auth.uid() and q.status = 'approved')
      )
    )
    or exists (select 1 from public.chat_rooms r where r.id = room_id and r.creator_id = auth.uid())
  );
create policy "members can leave" on public.room_members
  for delete to authenticated using (user_id = auth.uid());

-- Join requests
create policy "requesters and creators can view requests" on public.join_requests
  for select to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.chat_rooms r where r.id = room_id and r.creator_id = auth.uid())
  );
create policy "users request for themselves" on public.join_requests
  for insert to authenticated with check (user_id = auth.uid());
create policy "creators decide requests" on public.join_requests
  for update to authenticated using (
    exists (select 1 from public.chat_rooms r where r.id = room_id and r.creator_id = auth.uid())
  );
create policy "requesters can withdraw" on public.join_requests
  for delete to authenticated using (user_id = auth.uid());

-- Messages: members only
create policy "members read messages" on public.messages
  for select to authenticated using (
    exists (select 1 from public.room_members m where m.room_id = messages.room_id and m.user_id = auth.uid())
  );
create policy "members write their own messages" on public.messages
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.room_members m where m.room_id = messages.room_id and m.user_id = auth.uid())
  );
create policy "creators pin messages" on public.messages
  for update to authenticated using (
    exists (select 1 from public.chat_rooms r where r.id = room_id and r.creator_id = auth.uid())
  );

-- Realtime
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.join_requests;
