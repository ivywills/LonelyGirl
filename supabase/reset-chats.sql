-- DESTRUCTIVE: wipes every chat room and everything hanging off one.
--
-- Deleting from chat_rooms cascades to room_members, join_requests and
-- messages (all declared `on delete cascade` in schema.sql), so this one
-- statement clears the lot. There is no undo — take a backup first if you
-- want one.
--
-- Run in the Supabase SQL editor, per project, when you actually mean it.

-- Look before you leap: what is about to go.
select
  (select count(*) from public.chat_rooms) as rooms,
  (select count(*) from public.messages) as messages,
  (select count(*) from public.room_members) as memberships,
  (select count(*) from public.join_requests) as join_requests;

-- Uncomment to actually delete.
-- delete from public.chat_rooms;

-- Confirm afterwards — every count should be zero.
-- select
--   (select count(*) from public.chat_rooms) as rooms,
--   (select count(*) from public.messages) as messages,
--   (select count(*) from public.room_members) as memberships,
--   (select count(*) from public.join_requests) as join_requests;
