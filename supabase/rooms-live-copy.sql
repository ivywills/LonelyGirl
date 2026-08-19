-- The two live rooms' copy: name, description, tags, welcome message.
--
-- Only these two rooms are visible (hidden_at is null); everything else in
-- chat_rooms is archived. Idempotent — targeted by id, safe to re-run.
--
-- ROLLBACK — what these rows held before this script first ran:
--
--   ac75c98b-fbe2-4d82-9590-10ec57f749d9
--     name         'Making Friends'
--     description  'Introduce yourself to the LonelyGirl community and get to know other individuals on the platform. '
--     tags         {lonely,newintown,connection}
--     welcome      'Welcome to Making Friends — Please introduce yourself and greet new members!'
--
--   b82390c0-51ec-4fce-a551-bc38ce636d82
--     name         'Mental Wellness'
--     description  'grounding, tools, company'
--     tags         {anxiety,calm,grounding}
--     welcome      'welcome to Anxious & Okay — no pressure to say anything yet.'
--
-- Members, messages and pins are untouched — this is copy only.

-- Room 1 — intros / general
update public.chat_rooms set
  name = 'Say Hi',
  description = $$the first hello room. introduce yourself when you're ready — no rush, reading along counts too.$$,
  tags = '{newhere,introductions,nopressure}',
  welcome_message = $$welcome to Say Hi — introduce yourself when you're ready, no rush.$$
where id = 'ac75c98b-fbe2-4d82-9590-10ec57f749d9';

-- Room 2 — shy / nervous
update public.chat_rooms set
  name = 'Shy Girls Welcome',
  description = $$for the quiet ones, the overthinkers, the ones who type a message and delete it. come be nervous together — talking optional.$$,
  tags = '{shy,anxiety,quietones}',
  welcome_message = $$welcome to Shy Girls Welcome — talking optional.$$
where id = 'b82390c0-51ec-4fce-a551-bc38ce636d82';
