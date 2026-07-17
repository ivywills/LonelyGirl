-- Performance pass for hundreds of rooms/users. Run in Supabase SQL editor.

-- Indexes for the hot queries
create index if not exists room_members_user on public.room_members (user_id);
create index if not exists join_requests_room_status on public.join_requests (room_id, status);
create index if not exists join_requests_user on public.join_requests (user_id);
create index if not exists chat_rooms_created on public.chat_rooms (created_at desc);
create index if not exists chat_rooms_tags on public.chat_rooms using gin (tags);
create index if not exists messages_room_pinned on public.messages (room_id) where pinned;

-- Popular tags across all rooms (works with hundreds of tags)
create or replace function public.popular_tags(max_tags int default 30)
returns table(tag text, uses bigint)
language sql stable
set search_path = public
as $$
  select t as tag, count(*) as uses
  from public.chat_rooms, unnest(tags) as t
  group by t
  order by uses desc, t
  limit max_tags;
$$;

-- Optimised RLS: (select auth.uid()) is evaluated once per query instead of per row
drop policy if exists "members read messages" on public.messages;
create policy "members read messages" on public.messages
  for select to authenticated using (
    exists (
      select 1 from public.room_members m
      where m.room_id = messages.room_id and m.user_id = (select auth.uid())
    )
  );

drop policy if exists "members write their own messages" on public.messages;
create policy "members write their own messages" on public.messages
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.room_members m
      where m.room_id = messages.room_id and m.user_id = (select auth.uid())
    )
  );

drop policy if exists "requesters and creators can view requests" on public.join_requests;
create policy "requesters and creators can view requests" on public.join_requests
  for select to authenticated using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.chat_rooms r
      where r.id = room_id and r.creator_id = (select auth.uid())
    )
  );
