-- House style: no em dashes in copy. A dash becomes a full stop, or whatever
-- punctuation actually fits the sentence.
--
-- This covers the copy that lives in the database rather than in the code —
-- room descriptions and welcome messages, admin-authored. Members' own
-- messages are their words and are never touched.
--
-- Idempotent: the sweeps are `replace`, so a second run finds nothing to do.

-- Two descriptions read better with something other than a full stop.
update public.chat_rooms
  set description = 'fresh start, new chapter, reinvention, at any age'
  where id = '0bb3f973-722f-4e4d-adb5-88a304935cbf';

update public.chat_rooms
  set description = $$strained, distant, or estranged: family isn't always simple$$
  where id = '52467a54-63df-4922-8d00-385a779a74c9';

-- Everything else: the dash was joining two sentences, so make them two.
update public.chat_rooms
  set description = replace(description, ' — ', '. ')
  where description like '%—%';

update public.chat_rooms
  set welcome_message = replace(welcome_message, ' — ', '. ')
  where welcome_message like '%—%';
