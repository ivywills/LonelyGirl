-- A ready-to-use account for local development: test@test.ca / password
--
-- Run in the Supabase SQL editor of your DEV project only — never production.
-- Signing this address up through /signup would leave it sitting on an email
-- confirmation, so this writes a pre-confirmed user straight into auth and
-- gives it the matching email identity GoTrue expects.
--
-- Safe to run twice: it does nothing if the address already exists.

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  uid uuid;
begin
  select id into uid from auth.users where email = 'test@test.ca';
  if uid is not null then
    raise notice 'test@test.ca already exists (%) — nothing to do', uid;
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
    'test@test.ca', extensions.crypt('password', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    -- full_name is what the app shows as your display name in chat/events/playlists
    '{"full_name":"Test User"}'::jsonb,
    '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), uid, uid::text,
    format('{"sub":"%s","email":"test@test.ca","email_verified":true}', uid)::jsonb,
    'email', now(), now(), now()
  );

  raise notice 'created test@test.ca (%)', uid;
end $$;
