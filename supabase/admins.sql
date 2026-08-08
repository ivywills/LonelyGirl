-- Only admins can create chat rooms. Run in the Supabase SQL editor.
--
-- Hiding the button in the UI is not a control — the anon key lets anyone
-- POST to PostgREST directly — so the rule lives in RLS and the UI just
-- reflects it.
--
-- Safe to run twice.

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- Readable so the app can show/hide the create-room UI. No insert/update/
-- delete policy exists on purpose: admins are granted here in the SQL editor
-- (which bypasses RLS), never through the API, so nobody can promote
-- themselves even with a valid session.
drop policy if exists "admins list is readable by signed-in users" on public.admins;
create policy "admins list is readable by signed-in users" on public.admins
  for select to authenticated using (true);

/*
 * security definer so the policies below can read public.admins without
 * every caller needing their own select right on it, and stable so Postgres
 * evaluates it once per query rather than once per row.
 */
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Replace the old "anyone signed in can create a room" rule.
drop policy if exists "users create their own rooms" on public.chat_rooms;
drop policy if exists "admins create rooms" on public.chat_rooms;
create policy "admins create rooms" on public.chat_rooms
  for insert to authenticated
  with check ((select auth.uid()) = creator_id and public.is_admin());

-- Editing and deleting stay with whoever created the room, which is now
-- always an admin.
drop policy if exists "creators update their rooms" on public.chat_rooms;
create policy "creators update their rooms" on public.chat_rooms
  for update to authenticated using ((select auth.uid()) = creator_id);

drop policy if exists "creators delete their rooms" on public.chat_rooms;
create policy "creators delete their rooms" on public.chat_rooms
  for delete to authenticated using ((select auth.uid()) = creator_id);

/*
 * Grant the admins. Addresses that have not signed up yet are skipped with a
 * notice — sign in once, then rerun this file.
 */
do $$
declare
  addr text;
  uid uuid;
begin
  foreach addr in array array['willsivy1@gmail.com', 'test@test.com', 'test@test.ca']
  loop
    select id into uid from auth.users where email = addr;
    if uid is null then
      raise notice 'no account for % yet — sign up first, then rerun', addr;
    else
      insert into public.admins (user_id) values (uid)
      on conflict (user_id) do nothing;
      raise notice 'admin: % (%)', addr, uid;
    end if;
  end loop;
end $$;

-- Who is an admin right now:
select u.email, a.added_at
from public.admins a
join auth.users u on u.id = a.user_id
order by a.added_at;
