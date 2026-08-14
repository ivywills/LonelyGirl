-- Admin archive for chat rooms.
--
-- "Hiding" a room stamps hidden_at; the select policy then keeps it out of
-- every non-admin query — the directory, search, and the room page itself
-- (which 404s via RLS, since the row simply doesn't come back). Admins still
-- see hidden rooms and can restore them from the Archive rail at the bottom
-- of the chat directory.
--
-- Running this file hides nothing: every existing room keeps hidden_at null,
-- so users see exactly what they saw before until a room is hidden in the UI.
--
-- Idempotent: safe to re-run.

alter table public.chat_rooms add column if not exists hidden_at timestamptz;

-- Non-admins only see rooms that aren't hidden. Wrapped in (select ...) so
-- is_admin() is evaluated once per query, not once per row.
drop policy if exists "rooms are viewable by signed-in users" on public.chat_rooms;
create policy "rooms are viewable by signed-in users" on public.chat_rooms
  for select to authenticated
  using (hidden_at is null or (select public.is_admin()));

-- Any admin can hide or restore any room. Permissive alongside the existing
-- "creators update their rooms" policy, so either grants.
drop policy if exists "admins update any room" on public.chat_rooms;
create policy "admins update any room" on public.chat_rooms
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Sections can be archived too. Archiving a section stamps the SAME timestamp
-- onto the section and every not-already-hidden room in it; restoring clears
-- rooms matching that exact stamp, so rooms that were hidden individually
-- beforehand stay hidden. The stamping happens in the app — here it's just
-- the column and the select rule.
-- ---------------------------------------------------------------------------

alter table public.room_sections add column if not exists hidden_at timestamptz;

drop policy if exists "sections are viewable by signed-in users" on public.room_sections;
create policy "sections are viewable by signed-in users" on public.room_sections
  for select to authenticated
  using (hidden_at is null or (select public.is_admin()));

-- What's hidden right now:
select 'section' as kind, name, hidden_at from public.room_sections where hidden_at is not null
union all
select 'room', name, hidden_at from public.chat_rooms where hidden_at is not null
order by hidden_at desc;
