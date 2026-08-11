-- Profiles + onboarding. Run in Supabase SQL editor.
-- Idempotent and additive only (no drops) so it can be re-run safely.
--
-- NOTE ON SHAPE (differs from the handoff's proposed profiles.sql):
-- "struggles" lives in its own owner-only table, NOT as a column on profiles.
-- The handoff says those tags must never appear on the public card, but a
-- single table with a "viewable by signed-in users" read policy would still
-- serve them to anyone who queries the REST API directly with their own anon
-- key. Hiding a column in the UI is not hiding the data. RLS is row-level,
-- so the only way to make that guarantee real is a separate row.

-- ---------------------------------------------------------------------------
-- 1. Public profile
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '' check (char_length(name) <= 40),
  avatar_url text not null default '',
  avatar_color text not null default '#ffdf8e',
  -- Matches CITIES[0].id ("toronto"). Text, not an enum, so more cities can be
  -- added without a migration.
  city_id text not null default 'toronto',
  neighborhood text not null default '',
  age_range text not null default '',
  job text not null default '',
  hobbies text[] not null default '{}',
  fitness text[] not null default '{}',
  show_age boolean not null default true,
  show_job boolean not null default true,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Private profile — owner's eyes only
-- ---------------------------------------------------------------------------
-- Mental-health-adjacent self-description (grief, depression, chronic illness,
-- financial stress). Separate table so RLS can lock reads to the owner. When
-- matching logic needs this later, do it in a security-definer function that
-- returns match results, never raw rows.
create table if not exists public.profile_private (
  user_id uuid primary key references auth.users(id) on delete cascade,
  struggles text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- If an earlier version of this migration already added profiles.struggles,
-- carry the data across. The column is intentionally NOT dropped here — that
-- needs a human OK per this repo's rules. Drop it once you've confirmed the
-- copy: alter table public.profiles drop column struggles;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'struggles'
  ) then
    insert into public.profile_private (user_id, struggles)
    select p.user_id, p.struggles from public.profiles p
    where coalesce(array_length(p.struggles, 1), 0) > 0
    on conflict (user_id) do nothing;
    raise notice 'Copied existing profiles.struggles into profile_private. Drop the old column manually once verified.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Housekeeping
-- ---------------------------------------------------------------------------
create index if not exists profiles_neighborhood on public.profiles (city_id, neighborhood);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists profile_private_touch on public.profile_private;
create trigger profile_private_touch before update on public.profile_private
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;

-- Same phrasing as the existing rooms/events read policies: any signed-in user
-- can view any profile. It's a small trusted community, not a public directory.
drop policy if exists "profiles are viewable by signed-in users" on public.profiles;
create policy "profiles are viewable by signed-in users" on public.profiles
  for select to authenticated using (true);

drop policy if exists "users create their own profile" on public.profiles;
create policy "users create their own profile" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "users update their own profile" on public.profiles;
create policy "users update their own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Private: owner only, all four verbs. No "authenticated can read" policy here
-- on purpose — that absence is the whole point of the table.
drop policy if exists "owner reads their private profile" on public.profile_private;
create policy "owner reads their private profile" on public.profile_private
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "owner creates their private profile" on public.profile_private;
create policy "owner creates their private profile" on public.profile_private
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "owner updates their private profile" on public.profile_private;
create policy "owner updates their private profile" on public.profile_private
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 5. Card view — enforces show_age / show_job server-side
-- ---------------------------------------------------------------------------
-- show_age/show_job are a privacy promise, so they can't be a client-side
-- conditional render. Read cards through this view and the hidden fields come
-- back empty for everyone except the owner.
-- security_invoker = on keeps the caller's RLS on public.profiles in force.
create or replace view public.profile_cards
with (security_invoker = on) as
select
  p.user_id,
  p.name,
  p.avatar_url,
  p.avatar_color,
  p.city_id,
  p.neighborhood,
  case when p.show_age or p.user_id = (select auth.uid()) then p.age_range else '' end as age_range,
  case when p.show_job or p.user_id = (select auth.uid()) then p.job else '' end as job,
  p.hobbies,
  p.fitness,
  p.onboarded_at
from public.profiles p;

grant select on public.profile_cards to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Avatar storage — mirrors supabase/storage.sql's room-images bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars are public" on storage.objects;
create policy "avatars are public"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "signed-in users upload their own avatar" on storage.objects;
create policy "signed-in users upload their own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "users replace their own avatar" on storage.objects;
create policy "users replace their own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
