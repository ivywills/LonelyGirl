-- Demo account for Apple App Review: applereview@lonelygirl.app / LonelyGirl-Review1
--
-- App Review requires working credentials for login-gated apps. This account
-- is pre-confirmed and pre-onboarded (profiles row filled in) so the reviewer
-- lands straight in the app, and it is pre-joined to the Mental Wellness room
-- so chat isn't empty. Paste the credentials into the App Review notes.
--
-- Safe to run twice: does nothing if the address already exists.

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  uid uuid;
  room uuid;
begin
  select id into uid from auth.users where email = 'applereview@lonelygirl.app';
  if uid is not null then
    raise notice 'applereview@lonelygirl.app already exists (%) — nothing to do', uid;
    return;
  end if;

  uid := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    'applereview@lonelygirl.app', extensions.crypt('LonelyGirl-Review1', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"App Review"}'::jsonb,
    '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), uid, uid::text,
    format('{"sub":"%s","email":"applereview@lonelygirl.app","email_verified":true}', uid)::jsonb,
    'email', now(), now(), now()
  );

  -- Pre-onboarded so the reviewer skips the profile gate
  insert into public.profiles (user_id, name, neighborhood)
  values (uid, 'App Review', 'Toronto')
  on conflict (user_id) do nothing;

  -- Drop the reviewer into a real room so chat has life in it
  select id into room from public.chat_rooms where name = 'Mental Wellness' limit 1;
  if room is not null then
    insert into public.room_members (room_id, user_id, display_name)
    values (room, uid, 'App Review')
    on conflict do nothing;
  else
    raise notice 'no Mental Wellness room found — join a room manually for the reviewer';
  end if;

  raise notice 'created applereview@lonelygirl.app (%)', uid;
end $$;
