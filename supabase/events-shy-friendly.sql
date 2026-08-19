-- Shy-friendly events revision.
--
-- Two jobs:
--   1. Add the comfort fields the redesign reads: events.arrival_note / quiet /
--      first_timer.
--   2. Take plus_ones out of every count. The +1 feature contradicted the
--      community rule ("everyone comes alone") and has been removed from the UI.
--
-- Additive and idempotent — safe to re-run. The plus_ones COLUMN is left in
-- place on purpose: dropping it loses data, so ask Ivy first (CLAUDE.md).

-- ---------------------------------------------------------------------------
-- 1. Comfort fields on events
-- ---------------------------------------------------------------------------
alter table public.events
  add column if not exists arrival_note text not null default '',
  add column if not exists quiet boolean not null default false,
  add column if not exists first_timer boolean not null default false;

comment on column public.events.arrival_note is
  'Host-written "your first 90 seconds" note — how to find the group on arrival.';
comment on column public.events.quiet is
  'Talking is optional at this event; shown as a "quiet" badge.';
comment on column public.events.first_timer is
  'Flagged as an easy first event; shown as a "good first event" badge.';

-- No new policies needed: these ride along with the existing events select
-- policy and the admin write policy in events-admin.sql. If that policy names
-- columns explicitly, add these three there.

-- ---------------------------------------------------------------------------
-- 2. Retire plus_ones from the capacity math
-- ---------------------------------------------------------------------------

-- Any +1s already booked stop occupying seats.
update public.event_attendees set plus_ones = 0 where plus_ones <> 0;

-- Signed-out head counts: rows only.
create or replace function public.event_attendee_counts()
returns table (event_id uuid, going bigint)
language sql
security definer
set search_path = public
stable
as $$
  select event_id, count(*)::bigint
  from public.event_attendees group by event_id;
$$;
revoke all on function public.event_attendee_counts() from public;
grant execute on function public.event_attendee_counts() to anon, authenticated;

-- Waitlist promotion: same, rows only.
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
  select count(*) into taken
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

-- Stop new +1s at the database edge while the column still exists.
alter table public.event_attendees
  drop constraint if exists event_attendees_plus_ones_check;
alter table public.event_attendees
  add constraint event_attendees_plus_ones_check check (plus_ones = 0);

-- Rollback: drop the constraint above, restore the two functions from
-- supabase/events-redesign.sql. The three events columns are harmless to leave.
