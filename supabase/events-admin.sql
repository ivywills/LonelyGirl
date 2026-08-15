-- Hosting events is admin-only.
--
-- The events page shows the "Host an event" button to admins alone, but the
-- button is not the rule — this policy is. Booking and cancelling stay open
-- to any signed-in user; reading stays public (supabase/public-read.sql).
--
-- Events already created by non-admins are untouched — their creators can
-- still edit and delete them, they just can't make new ones.
--
-- Requires public.is_admin() from supabase/admins.sql. Idempotent.

drop policy if exists "users create their own events" on public.events;
drop policy if exists "admins create events" on public.events;
create policy "admins create events" on public.events
  for insert to authenticated
  with check ((select auth.uid()) = creator_id and (select public.is_admin()));

-- Any admin can edit or delete any event, not only the one who created it —
-- permissive alongside the creator policies, so either grants.
drop policy if exists "admins update any event" on public.events;
create policy "admins update any event" on public.events
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "admins delete any event" on public.events;
create policy "admins delete any event" on public.events
  for delete to authenticated
  using ((select public.is_admin()));
