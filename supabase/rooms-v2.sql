-- Room set v2: 16 rooms across 4 sections, with photos.
--
-- Replaces the 12 starter rooms from room-sections.sql. Source of truth is
-- ~/Documents/rooms.csv; this file is that CSV expressed as SQL.
--
-- Photos live in the room-images bucket (seed/ prefix), not in the repo, so
-- they can be swapped from a room's own Settings screen without a redeploy.
-- Absolute Storage URLs resolve the same in web, Electron and Capacitor.
--
-- Safe to run twice. The rename step is a no-op once it has run, and every
-- room is upserted by its new name.

-- ---------------------------------------------------------------------------
-- 1. Sections
--
-- The CSV's section labels become the rail titles; the old editorial lines
-- become the subtitles under them, which is the pairing the design expects
-- (plain title, muted line beneath).
-- ---------------------------------------------------------------------------

do $$
declare
  s record;
begin
  for s in
    select * from (values
      ('Support & mental health', 'a soft place to land',    'volunteer_activism', 10, 'A soft place to land'),
      ('Growth & habits',         'grow a little every day', 'self_improvement',   20, 'Grow a little every day'),
      ('Movement & wellness',     'move at your own pace',   'directions_run',     30, 'Move at your own pace'),
      ('Connection',              'the people part',         'diversity_1',        40, null)
    ) as t(name, subtitle, icon, sort_order, old_name)
  loop
    -- Rename the v1 section if it's still under its old title
    if s.old_name is not null then
      update public.room_sections set name = s.name where name = s.old_name;
    end if;

    if exists (select 1 from public.room_sections where name = s.name) then
      update public.room_sections
      set subtitle = s.subtitle, icon = s.icon, sort_order = s.sort_order
      where name = s.name;
    else
      insert into public.room_sections (name, subtitle, icon, sort_order)
      values (s.name, s.subtitle, s.icon, s.sort_order);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Rooms
--
-- The 12 v1 rooms are renamed in place rather than dropped and recreated —
-- they carry no messages, but renaming keeps their ids, memberships and
-- ownership intact instead of churning them.
-- ---------------------------------------------------------------------------

do $$
declare
  base text := 'https://xngmeoxwpmtesmmutaeu.supabase.co/storage/v1/object/public/room-images/seed/';
  owner_id uuid;
  r record;
begin
  select id into owner_id from auth.users where email = 'willsivy1@gmail.com';
  if owner_id is null then
    select user_id into owner_id from public.admins order by added_at limit 1;
  end if;
  if owner_id is null then
    raise exception 'no admin account found to own the rooms';
  end if;

  for r in
    select * from (values
      -- new name,                   old name (v1),        section,                   blurb,                                                        tags,                                                            colour,    image slug
      ('Living with Anxiety',        'Anxious & Okay',     'Support & mental health', 'grounding, tools, company',                                   array['anxiety','calm','grounding'],                             '#7c3aed', 'living-with-anxiety'),
      ('Work Stress',                'Sunday Scaries',     'Support & mental health', 'for the pressure that follows you home',                      array['work','burnout','anxiety'],                               '#ea580c', 'work-stress'),
      ('Grief & Loss',               'The Grief Table',    'Support & mental health', 'for missing, and for remembering',                            array['grief','loss','remembering'],                             '#2563eb', 'grief-loss'),
      ('Burnout & Recovery',         'Burnout Recovery',   'Support & mental health', 'for the tired and the depleted',                              array['burnout','rest','work'],                                  '#0d9488', 'burnout-recovery'),
      ('Focus & Deep Work',          'Morning Pages',      'Growth & habits',         'attention, protected',                                        array['focus','work','habits'],                                  '#16a34a', 'focus-deep-work'),
      ('Building Habits',            'Tiny Habits',        'Growth & habits',         '1% better, no pressure',                                      array['habits','motivation','goals'],                            '#ca8a04', 'building-habits'),
      ('Boundaries',                 'Boundaries Club',    'Growth & habits',         'learning to say no, kindly',                                  array['boundaries','growth','work'],                             '#9333ea', 'boundaries'),
      ('Starting Over',              'The Reset',          'Growth & habits',         'fresh start, new chapter, reinvention — at any age',          array['growth','freshstart','reinvention','moving','newintown'], '#4f46e5', 'starting-over'),
      ('Strength Training',          'Slow Runners of TO', 'Movement & wellness',     'starting, restarting, sticking with it',                      array['strength','movement','habits'],                           '#0891b2', 'strength-training'),
      ('Sober Curious',              'Sober Curious',      'Movement & wellness',     'rethinking the drink, no judgment',                           array['sober','wellness','habits'],                              '#0d9488', 'sober-curious'),
      ('Sleep',                      'Cold Water Club',    'Movement & wellness',     'winding down and actually resting',                           array['sleep','rest','calm'],                                    '#2563eb', 'sleep'),
      ('Home Practice',              'Yoga at Home',       'Movement & wellness',     'yoga and stretching, cameras optional',                       array['yoga','movement','calm'],                                 '#7c3aed', 'home-practice'),
      ('Making Friends as an Adult', null,                 'Connection',              'it''s harder now, and that''s normal',                        array['lonely','newintown','connection'],                        '#ea580c', 'making-friends-adult'),
      ('New in Town',                null,                 'Connection',              'finding your footing somewhere new',                          array['newintown','moving','lonely'],                            '#0891b2', 'new-in-town'),
      ('Family Ties',                null,                 'Connection',              'strained, distant, or estranged — family isn''t always simple', array['family','boundaries','grief'],                          '#9333ea', 'family-ties'),
      ('Caregiving',                 null,                 'Connection',              'supporting someone who needs you',                            array['caregiving','burnout','grief'],                           '#16a34a', 'caregiving')
    ) as t(name, old_name, section, blurb, tags, bg_color, slug)
  loop
    if r.old_name is not null then
      update public.chat_rooms set name = r.name where name = r.old_name;
    end if;

    if exists (select 1 from public.chat_rooms where name = r.name) then
      update public.chat_rooms
      set description = r.blurb,
          tags        = r.tags,
          bg_color    = r.bg_color,
          image_url   = base || r.slug || '.jpg',
          section_id  = (select id from public.room_sections where name = r.section)
      where name = r.name;
    else
      insert into public.chat_rooms
        (creator_id, name, description, tags, bg_color, image_url, is_private, welcome_message, section_id)
      values
        (owner_id, r.name, r.blurb, r.tags, r.bg_color, base || r.slug || '.jpg', false,
         format('welcome to %s — no pressure to say anything yet.', r.name),
         (select id from public.room_sections where name = r.section));
    end if;
  end loop;

  -- Owner is admin, creator and member of everything
  update public.chat_rooms set creator_id = owner_id where creator_id <> owner_id;
  insert into public.room_members (room_id, user_id, display_name)
  select c.id, owner_id, coalesce(
           nullif(u.raw_user_meta_data->>'full_name',''),
           nullif(u.raw_user_meta_data->>'name',''),
           split_part(u.email,'@',1))
  from public.chat_rooms c, auth.users u where u.id = owner_id
  on conflict (room_id, user_id) do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Check it
-- ---------------------------------------------------------------------------

select s.sort_order, s.name as section, s.subtitle,
       count(r.id) as rooms, count(r.id) filter (where r.image_url <> '') as with_photo
from public.room_sections s
left join public.chat_rooms r on r.section_id = s.id
group by s.id, s.sort_order, s.name, s.subtitle
order by s.sort_order;
