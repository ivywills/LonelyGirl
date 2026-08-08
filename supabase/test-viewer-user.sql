-- A non-admin account for checking the ordinary-user view: user@test.com
--
-- Deliberately NOT added to public.admins, so signing in as this account is
-- how you see the chat page without the create-room controls — and confirm
-- the RLS rule holds, not just the hidden button.
--
-- Same approach as dev-user.sql: signing this address up through /signup
-- would leave it waiting on an email confirmation, so this writes a
-- pre-confirmed user straight into auth with the email identity GoTrue
-- expects. Run in the Supabase SQL editor of whichever project you want it in.
--
-- Safe to run twice: it does nothing if the address already exists.

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  uid uuid;
  -- Change these two if you want different credentials.
  addr text := 'user@test.com';
  pass text := 'password';
begin
  select id into uid from auth.users where email = addr;
  if uid is not null then
    raise notice '% already exists (%) — nothing to do', addr, uid;
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
    addr, extensions.crypt(pass, extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    -- full_name is what the app shows as your display name in chat/events/playlists
    '{"full_name":"Test Viewer"}'::jsonb,
    '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), uid, uid::text,
    format('{"sub":"%s","email":"%s","email_verified":true}', uid, addr)::jsonb,
    'email', now(), now(), now()
  );

  raise notice 'created % (%) — not an admin, by design', addr, uid;
end $$;
