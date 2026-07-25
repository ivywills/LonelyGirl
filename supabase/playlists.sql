-- Playlists: one vinyl record per row on the /playlists wall.
-- Run in Supabase SQL editor.

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  creator_name text not null default '',
  title text not null check (char_length(title) between 1 and 60),
  apple_url text not null default '',
  color text not null default '#db2777',
  song_count int not null default 12 check (song_count > 0),
  note text not null default '',
  created_at timestamptz not null default now()
);

-- The wall loads oldest first so the drop order stays stable between visits
create index if not exists playlists_created_at on public.playlists (created_at);

alter table public.playlists enable row level security;

create policy "playlists are viewable by signed-in users" on public.playlists
  for select to authenticated using (true);
create policy "users add their own playlists" on public.playlists
  for insert to authenticated with check (auth.uid() = creator_id);
create policy "creators delete their playlists" on public.playlists
  for delete to authenticated using (auth.uid() = creator_id);
