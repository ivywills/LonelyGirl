-- Room sections (the rails on /chat) + the starter set of rooms.
--
-- Run in the Supabase SQL editor. Safe to run twice: the table/column work is
-- guarded, and the seed matches rooms by name, so rerunning updates the twelve
-- starter rooms in place instead of duplicating them.
--
-- Run supabase/admins.sql first if you haven't (this file re-declares
-- public.is_admin() so either order works, but admins.sql is what grants the
-- admin list itself).
--
-- WHAT "ADMIN OF A ROOM" MEANS HERE: there is no per-room role table. The
-- room's creator_id is its owner — the only account that can edit it, delete
-- it or pin messages. So section 4 below points creator_id at
-- willsivy1@gmail.com for EVERY room, which also transfers any room another
-- account created.

-- ---------------------------------------------------------------------------
-- 1. Sections
-- ---------------------------------------------------------------------------

create table if not exists public.room_sections (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  subtitle text not null default '',
  -- Material Symbols Rounded glyph name, shown beside the rail title
  icon text not null default 'forum',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Rooms with no section fall into the trailing "More rooms" rail. on delete
-- set null means deleting a section keeps its rooms — they just come loose.
alter table public.chat_rooms
  add column if not exists section_id uuid references public.room_sections(id) on delete set null;

create index if not exists chat_rooms_section on public.chat_rooms (section_id);

alter table public.room_sections enable row level security;

/*
 * Same definition as admins.sql — repeated so this file stands on its own.
 * security definer so the policies can read public.admins without every
 * caller holding a select right on it; stable so Postgres evaluates it once
 * per query rather than once per row.
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

drop policy if exists "sections are viewable by signed-in users" on public.room_sections;
create policy "sections are viewable by signed-in users" on public.room_sections
  for select to authenticated using (true);

-- Creating, renaming and deleting sections is admin-only. The UI hides the
-- controls for everyone else, but this is the rule that actually holds.
drop policy if exists "admins create sections" on public.room_sections;
create policy "admins create sections" on public.room_sections
  for insert to authenticated with check (public.is_admin());

drop policy if exists "admins update sections" on public.room_sections;
create policy "admins update sections" on public.room_sections
  for update to authenticated using (public.is_admin());

drop policy if exists "admins delete sections" on public.room_sections;
create policy "admins delete sections" on public.room_sections
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 2. Seed the three sections
-- ---------------------------------------------------------------------------

insert into public.room_sections (name, subtitle, icon, sort_order)
select v.name, v.subtitle, v.icon, v.sort_order
from (values
  ('A soft place to land',   'support & mental health',  'volunteer_activism', 10),
  ('Grow a little every day','personal growth & habits', 'self_improvement',   20),
  ('Move at your own pace',  'movement & wellness',      'directions_run',     30)
) as v(name, subtitle, icon, sort_order)
where not exists (select 1 from public.room_sections s where s.name = v.name);

-- ---------------------------------------------------------------------------
-- 3. Seed the twelve starter rooms
--
-- image_url is left empty on purpose — the directory draws the striped
-- placeholder until a photo is uploaded from the room's settings.
-- ---------------------------------------------------------------------------

do $$
declare
  owner_id uuid;
  r record;
  existing uuid;
begin
  -- Whoever owns the seeded rooms: you first, then the local dev accounts,
  -- then any admin, then any user at all. Local projects where you have never
  -- signed in still get a working seed.
  select id into owner_id from auth.users where email = 'willsivy1@gmail.com';
  if owner_id is null then
    select id into owner_id from auth.users where email in ('test@test.ca', 'test@test.com') order by created_at limit 1;
  end if;
  if owner_id is null then
    select user_id into owner_id from public.admins order by added_at limit 1;
  end if;
  if owner_id is null then
    select id into owner_id from auth.users order by created_at limit 1;
  end if;
  if owner_id is null then
    raise exception 'no accounts exist in this project yet — sign up once, then rerun';
  end if;

  raise notice 'seeding rooms owned by % (%)', (select email from auth.users where id = owner_id), owner_id;

  for r in
    select * from (values
      ('Anxious & Okay',     'a calm corner for anxious minds',   '#7c3aed', array['anxiety','anxious','calm','grounding'],       'A soft place to land'),
      ('Sunday Scaries',     'soothing the sunday-night dread',   '#ea580c', array['anxiety','work','burnout','lonely'],           'A soft place to land'),
      ('The Grief Table',    'for loss, missing & remembering',   '#2563eb', array['grief','loss','remembering','lonely'],         'A soft place to land'),
      ('Burnout Recovery',   'for the tired and the over-it',     '#0d9488', array['burnout','tired','rest','work'],               'A soft place to land'),
      ('Morning Pages',      'three pages, every morning',        '#16a34a', array['writing','habits','motivation','morning'],     'Grow a little every day'),
      ('Tiny Habits',        '1% better, zero pressure',          '#ca8a04', array['habits','motivation','goals'],                 'Grow a little every day'),
      ('Boundaries Club',    'learning to say no, kindly',        '#9333ea', array['boundaries','growth','anxiety'],               'Grow a little every day'),
      ('The Reset',          'starting over, at any age',         '#4f46e5', array['growth','motivation','newintown','moving'],    'Grow a little every day'),
      ('Slow Runners of TO', 'back of the pack & proud',          '#0891b2', array['running','movement','toronto','newintown'],    'Move at your own pace'),
      ('Sober Curious',      'rethinking the drink, no judgment', '#0d9488', array['sober','wellness','habits','lonely'],          'Move at your own pace'),
      ('Cold Water Club',    'lake ontario dips at dawn',         '#2563eb', array['swimming','movement','toronto','newintown'],   'Move at your own pace'),
      ('Yoga at Home',       'mats down, cameras optional',       '#7c3aed', array['yoga','movement','wellness','calm'],           'Move at your own pace')
    ) as t(name, description, bg_color, tags, section)
  loop
    select id into existing from public.chat_rooms where name = r.name limit 1;
    if existing is null then
      insert into public.chat_rooms (creator_id, name, description, bg_color, tags, is_private, welcome_message, section_id)
      values (
        owner_id, r.name, r.description, r.bg_color, r.tags, false,
        format('welcome to %s — no pressure to say anything yet.', r.name),
        (select id from public.room_sections s where s.name = r.section)
      );
      raise notice 'created room %', r.name;
    else
      update public.chat_rooms
      set description = r.description,
          bg_color = r.bg_color,
          tags = r.tags,
          section_id = (select id from public.room_sections s where s.name = r.section)
      where id = existing;
      raise notice 'updated room %', r.name;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Make willsivy1@gmail.com an admin, and owner + member of every room
--
-- The update is the ownership transfer flagged at the top: after this, every
-- room in the project is yours to edit, delete and pin in.
-- ---------------------------------------------------------------------------

do $$
declare
  uid uuid;
  who text;
begin
  select id into uid from auth.users where email = 'willsivy1@gmail.com';
  if uid is null then
    raise notice 'no willsivy1@gmail.com account in this project — sign in once there, then rerun this block';
    return;
  end if;

  insert into public.admins (user_id) values (uid) on conflict (user_id) do nothing;

  update public.chat_rooms set creator_id = uid where creator_id <> uid;

  select coalesce(
    nullif(raw_user_meta_data->>'full_name', ''),
    nullif(raw_user_meta_data->>'name', ''),
    split_part(email, '@', 1)
  ) into who from auth.users where id = uid;

  insert into public.room_members (room_id, user_id, display_name)
  select r.id, uid, who from public.chat_rooms r
  on conflict (room_id, user_id) do nothing;

  raise notice 'willsivy1@gmail.com (%) is admin, owner and member of all % rooms', uid, (select count(*) from public.chat_rooms);
end $$;

-- ---------------------------------------------------------------------------
-- 5. Check it
-- ---------------------------------------------------------------------------

select s.sort_order, s.name as section, s.subtitle, count(r.id) as rooms
from public.room_sections s
left join public.chat_rooms r on r.section_id = s.id
group by s.id, s.sort_order, s.name, s.subtitle
order by s.sort_order;

select r.name as room, s.name as section, u.email as owner,
       exists (select 1 from public.room_members m where m.room_id = r.id and m.user_id = r.creator_id) as owner_is_member
from public.chat_rooms r
left join public.room_sections s on s.id = r.section_id
join auth.users u on u.id = r.creator_id
order by s.sort_order nulls last, r.name;
