-- Events redesign ("week planner"): reactions, waitlist, saves, reminders, +1s.
--
-- Everything here is additive — no existing rows are touched. Idempotent:
-- safe to re-run. RLS follows the house patterns (events.sql, public-read.sql):
-- writes are always own-row-only, anything world-readable goes through a
-- security-definer counts function instead of an anon select on the table.

-- ---------------------------------------------------------------------------
-- event_attendees gains plus_ones: a booked guest can bring one +1. Capacity
-- math everywhere becomes going = count(rows) + sum(plus_ones).
-- ---------------------------------------------------------------------------
alter table public.event_attendees
  add column if not exists plus_ones int not null default 0
    check (plus_ones >= 0 and plus_ones <= 1);

-- Needed so a guest can toggle their own +1
drop policy if exists "users update their own booking" on public.event_attendees;
create policy "users update their own booking" on public.event_attendees
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- The signed-out head-count function (public-read.sql) now counts +1s too
create or replace function public.event_attendee_counts()
returns table (event_id uuid, going bigint)
language sql
security definer
set search_path = public
stable
as $$
  select event_id, (count(*) + coalesce(sum(plus_ones), 0))::bigint
  from public.event_attendees group by event_id;
$$;
revoke all on function public.event_attendee_counts() from public;
grant execute on function public.event_attendee_counts() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- event_reactions: the hype meter. One row per user per reaction kind.
-- Counts are public (via the function below); who reacted is not.
-- ---------------------------------------------------------------------------
create table if not exists public.event_reactions (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('love', 'so_in', 'hype', 'nice')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id, kind)
);

alter table public.event_reactions enable row level security;

drop policy if exists "users see their own reactions" on public.event_reactions;
create policy "users see their own reactions" on public.event_reactions
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "users react for themselves" on public.event_reactions;
create policy "users react for themselves" on public.event_reactions
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "users unreact for themselves" on public.event_reactions;
create policy "users unreact for themselves" on public.event_reactions
  for delete to authenticated using (user_id = (select auth.uid()));

-- Public counts, same shape of trick as event_attendee_counts()
create or replace function public.event_reaction_counts()
returns table (event_id uuid, kind text, reactions bigint)
language sql
security definer
set search_path = public
stable
as $$
  select event_id, kind, count(*)::bigint
  from public.event_reactions group by event_id, kind;
$$;
revoke all on function public.event_reaction_counts() from public;
grant execute on function public.event_reaction_counts() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- event_waitlist: position = order of created_at. Visible to signed-in users
-- (same visibility as the attendee list) so the client can show "#N in line".
-- ---------------------------------------------------------------------------
create table if not exists public.event_waitlist (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.event_waitlist enable row level security;

drop policy if exists "waitlist viewable by signed-in users" on public.event_waitlist;
create policy "waitlist viewable by signed-in users" on public.event_waitlist
  for select to authenticated using (true);
drop policy if exists "users queue for themselves" on public.event_waitlist;
create policy "users queue for themselves" on public.event_waitlist
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "users leave their own queue spot" on public.event_waitlist;
create policy "users leave their own queue spot" on public.event_waitlist
  for delete to authenticated using (user_id = (select auth.uid()));

-- When a booking is cancelled and a spot frees up, the first person in line
-- is promoted automatically. Security definer: the canceller couldn't insert
-- an attendee row for someone else under RLS, so the trigger does it.
create or replace function public.promote_from_waitlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cap int;
  taken bigint;
  nxt record;
begin
  select capacity into cap from events where id = old.event_id;
  if cap is null then return old; end if;
  select coalesce(count(*) + sum(plus_ones), 0) into taken
    from event_attendees where event_id = old.event_id;
  if taken >= cap then return old; end if;
  select * into nxt from event_waitlist
    where event_id = old.event_id order by created_at limit 1;
  if nxt is null then return old; end if;
  delete from event_waitlist
    where event_id = nxt.event_id and user_id = nxt.user_id;
  insert into event_attendees (event_id, user_id, display_name)
    values (
      nxt.event_id,
      nxt.user_id,
      coalesce((select name from profile_cards where user_id = nxt.user_id), '')
    )
    on conflict do nothing;
  return old;
end;
$$;

drop trigger if exists event_attendees_promote on public.event_attendees;
create trigger event_attendees_promote
  after delete on public.event_attendees
  for each row execute function public.promote_from_waitlist();

-- ---------------------------------------------------------------------------
-- event_saves / event_reminders: private per-user toggles. Nobody else can
-- see, add to, or clear your saved list or your reminders.
-- ---------------------------------------------------------------------------
create table if not exists public.event_saves (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.event_saves enable row level security;

drop policy if exists "users see their own saves" on public.event_saves;
create policy "users see their own saves" on public.event_saves
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "users save for themselves" on public.event_saves;
create policy "users save for themselves" on public.event_saves
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "users unsave for themselves" on public.event_saves;
create policy "users unsave for themselves" on public.event_saves
  for delete to authenticated using (user_id = (select auth.uid()));

create table if not exists public.event_reminders (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.event_reminders enable row level security;

drop policy if exists "users see their own reminders" on public.event_reminders;
create policy "users see their own reminders" on public.event_reminders
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "users set their own reminders" on public.event_reminders;
create policy "users set their own reminders" on public.event_reminders
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "users clear their own reminders" on public.event_reminders;
create policy "users clear their own reminders" on public.event_reminders
  for delete to authenticated using (user_id = (select auth.uid()));
