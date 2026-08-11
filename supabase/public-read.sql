-- Public read for /events and /scrapbook.
--
-- Why: both pages used to redirect signed-out visitors to /login, so someone
-- arriving from Instagram hit a sign-up form before seeing a single reason to
-- make an account. Reading is now open; every write path still requires auth
-- (the existing "to authenticated" insert/update/delete policies are untouched).
--
-- Idempotent: safe to re-run. Only adds SELECT policies for the anon role.

-- ---------------------------------------------------------------------------
-- events: fully public to read.
-- ---------------------------------------------------------------------------
drop policy if exists "events are viewable by anyone" on public.events;
create policy "events are viewable by anyone" on public.events
  for select to anon using (true);

-- ---------------------------------------------------------------------------
-- scrapbook_entries: fully public to read.
--
-- NOTE: this makes every existing entry — caption, photo and author display
-- name — visible to the whole internet. Entries pinned before this ran were
-- posted when only signed-in users could see them. The images were already in
-- a public storage bucket (supabase/scrapbook.sql), so the photos themselves
-- were reachable by URL, but the names and captions were not.
-- ---------------------------------------------------------------------------
drop policy if exists "scrapbook entries viewable by anyone" on public.scrapbook_entries;
create policy "scrapbook entries viewable by anyone" on public.scrapbook_entries
  for select to anon using (true);

-- ---------------------------------------------------------------------------
-- event_attendees stays PRIVATE.
--
-- Who is going to a given event is exactly the kind of thing that should not
-- be world-readable on this site, so there is deliberately no anon policy on
-- the table. Signed-out visitors instead get head counts only, through this
-- security-definer function — it can see the table, the caller cannot.
-- ---------------------------------------------------------------------------
create or replace function public.event_attendee_counts()
returns table (event_id uuid, going bigint)
language sql
security definer
set search_path = public
stable
as $$
  select event_id, count(*)::bigint from public.event_attendees group by event_id;
$$;

revoke all on function public.event_attendee_counts() from public;
grant execute on function public.event_attendee_counts() to anon, authenticated;
