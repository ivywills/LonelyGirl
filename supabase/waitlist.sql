-- Waitlist for the Instagram bio link (/waitlist).
--
-- Run in the Supabase SQL editor. Safe to run twice.
--
-- The shape of this table is deliberately minimal: an address, where it came
-- from, and when. Nothing here needs a name or an account, and asking for
-- less is the point — the page has to convert a stranger who tapped a bio
-- link, and every extra field costs sign-ups.

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null check (
    position('@' in email) > 1 and char_length(email) between 5 and 254
  ),
  /* Where the tap came from — set from ?from= on the page, so you can tell
     Instagram bio traffic from a story link or a poster QR code. */
  source text not null default '',
  created_at timestamptz not null default now()
);

-- Case-insensitive uniqueness: someone typing Ivy@… then ivy@… is one person.
create unique index if not exists waitlist_email_key on public.waitlist (lower(email));

create index if not exists waitlist_created on public.waitlist (created_at desc);

alter table public.waitlist enable row level security;

/*
 * Anyone may add themselves — that is the whole point of a waitlist, and it
 * is the one place in this schema where an anonymous write is correct.
 */
drop policy if exists "anyone can join the waitlist" on public.waitlist;
create policy "anyone can join the waitlist" on public.waitlist
  for insert to anon, authenticated with check (true);

/*
 * There is deliberately NO select policy, and none for update or delete.
 *
 * A list of email addresses behind a public anon key is a harvesting target:
 * the key ships in the browser bundle, so any select policy here would mean
 * anyone could page through every address you collect. Reading happens in the
 * SQL editor (which bypasses RLS) or over psql — see the queries at the
 * bottom. The page never reads back either; it only inserts.
 *
 * The trade-off: the app can't tell a returning visitor they're already on
 * the list. Duplicates surface as a unique-violation on insert instead, which
 * the page treats as success — same outcome for the visitor, no leak of who
 * is on the list.
 */

-- ---------------------------------------------------------------------------
-- Reading the list (run these here, or over psql — never from the app)
-- ---------------------------------------------------------------------------

-- How it's going:
select count(*) as total,
       count(*) filter (where created_at > now() - interval '24 hours') as last_24h,
       count(*) filter (where created_at > now() - interval '7 days') as last_7d
from public.waitlist;

-- Where they came from:
select coalesce(nullif(source, ''), '(direct)') as source, count(*)
from public.waitlist group by 1 order by 2 desc;

-- The addresses, newest first — this is what you'd paste into a mail tool:
select email, source, created_at
from public.waitlist
order by created_at desc;
