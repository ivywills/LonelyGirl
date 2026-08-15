-- Moderation for App Store review (Guideline 1.2 — user-generated content):
-- reports, user blocking, bans, message deletion, and in-app account deletion.
-- Safe to run twice. Requires admins.sql (public.is_admin) to have run first.

-- ---------------------------------------------------------------------------
-- Reports: anyone can flag a message or a user; admins review and resolve.
-- The message content is snapshotted so the report still makes sense after
-- the message itself is deleted.
-- ---------------------------------------------------------------------------

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid not null references auth.users(id) on delete cascade,
  message_id bigint references public.messages(id) on delete set null,
  message_content text not null default '',
  room_id uuid references public.chat_rooms(id) on delete set null,
  reason text not null default '' check (char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create index if not exists reports_open on public.reports (created_at desc) where resolved_at is null;

alter table public.reports enable row level security;

drop policy if exists "users file their own reports" on public.reports;
create policy "users file their own reports" on public.reports
  for insert to authenticated with check (reporter_id = (select auth.uid()));

drop policy if exists "admins read reports" on public.reports;
create policy "admins read reports" on public.reports
  for select to authenticated using (public.is_admin());

drop policy if exists "admins resolve reports" on public.reports;
create policy "admins resolve reports" on public.reports
  for update to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Blocks: personal — hides the blocked user's messages for the blocker only.
-- ---------------------------------------------------------------------------

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;

drop policy if exists "users see their own blocks" on public.user_blocks;
create policy "users see their own blocks" on public.user_blocks
  for select to authenticated using (blocker_id = (select auth.uid()));

drop policy if exists "users block for themselves" on public.user_blocks;
create policy "users block for themselves" on public.user_blocks
  for insert to authenticated with check (blocker_id = (select auth.uid()));

drop policy if exists "users unblock for themselves" on public.user_blocks;
create policy "users unblock for themselves" on public.user_blocks
  for delete to authenticated using (blocker_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Bans: admin-only, app-wide — a banned account can no longer post.
-- ---------------------------------------------------------------------------

create table if not exists public.user_bans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  banned_by uuid references auth.users(id) on delete set null,
  reason text not null default '',
  created_at timestamptz not null default now()
);

alter table public.user_bans enable row level security;

-- Banned users can see their own ban (so the UI can say so); admins see all.
drop policy if exists "bans visible to admins and the banned" on public.user_bans;
create policy "bans visible to admins and the banned" on public.user_bans
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "admins ban" on public.user_bans;
create policy "admins ban" on public.user_bans
  for insert to authenticated with check (public.is_admin());

drop policy if exists "admins unban" on public.user_bans;
create policy "admins unban" on public.user_bans
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Messages: authors and admins can delete; banned accounts cannot post.
-- The insert policy replaces the one from performance.sql, adding the ban
-- check — same (select auth.uid()) once-per-query shape.
-- ---------------------------------------------------------------------------

drop policy if exists "authors and admins delete messages" on public.messages;
create policy "authors and admins delete messages" on public.messages
  for delete to authenticated using (
    user_id = (select auth.uid()) or public.is_admin()
  );

drop policy if exists "members write their own messages" on public.messages;
create policy "members write their own messages" on public.messages
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.room_members m
      where m.room_id = messages.room_id and m.user_id = (select auth.uid())
    )
    and not exists (
      select 1 from public.user_bans b where b.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Account deletion (App Store Guideline 5.1.1(v)). Deleting the auth.users
-- row cascades through every app table that references it. Called via RPC
-- from the account page; only ever deletes the caller's own account.
-- ---------------------------------------------------------------------------

create or replace function public.delete_user_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_user_account() from public;
grant execute on function public.delete_user_account() to authenticated;
