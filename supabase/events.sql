-- Events: find / book / host. Run in Supabase SQL editor.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  description text not null default '',
  category text not null default 'meetup',
  location text not null default '',
  starts_at timestamptz not null,
  capacity int check (capacity is null or capacity > 0),
  bg_color text not null default '#7c3aed',
  image_url text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists events_starts_at on public.events (starts_at);

create table if not exists public.event_attendees (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '',
  booked_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.events enable row level security;
alter table public.event_attendees enable row level security;

create policy "events are viewable by signed-in users" on public.events
  for select to authenticated using (true);
create policy "users create their own events" on public.events
  for insert to authenticated with check (auth.uid() = creator_id);
create policy "creators update their events" on public.events
  for update to authenticated using (auth.uid() = creator_id);
create policy "creators delete their events" on public.events
  for delete to authenticated using (auth.uid() = creator_id);

create policy "attendees viewable by signed-in users" on public.event_attendees
  for select to authenticated using (true);
create policy "users book for themselves" on public.event_attendees
  for insert to authenticated with check (user_id = auth.uid());
create policy "users cancel their own booking" on public.event_attendees
  for delete to authenticated using (user_id = auth.uid());
