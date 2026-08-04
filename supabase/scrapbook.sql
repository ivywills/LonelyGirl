-- Scrapbook: a shared wall of pinned photos and notes. Run in Supabase SQL editor.

create table if not exists public.scrapbook_entries (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '',
  caption text not null default '' check (char_length(caption) <= 280),
  image_url text not null default '',
  bg_color text not null default '#7c3aed',
  -- Small random tilt baked in at insert so the wall looks pinned by hand
  -- rather than laid out on a grid, and so it stays the same on every load.
  rotation real not null default 0 check (rotation between -12 and 12),
  created_at timestamptz not null default now()
);

create index if not exists scrapbook_entries_created_at
  on public.scrapbook_entries (created_at desc);

alter table public.scrapbook_entries enable row level security;

-- auth.uid() wrapped in a scalar subquery so Postgres evaluates it once per
-- query instead of once per row (same pattern as supabase/performance.sql).
create policy "scrapbook entries viewable by signed-in users"
  on public.scrapbook_entries
  for select to authenticated using (true);

create policy "users add their own scrapbook entries"
  on public.scrapbook_entries
  for insert to authenticated with check ((select auth.uid()) = author_id);

create policy "authors update their scrapbook entries"
  on public.scrapbook_entries
  for update to authenticated using ((select auth.uid()) = author_id);

create policy "authors delete their scrapbook entries"
  on public.scrapbook_entries
  for delete to authenticated using ((select auth.uid()) = author_id);

-- Photo uploads for the scrapbook.
insert into storage.buckets (id, name, public)
values ('scrapbook-images', 'scrapbook-images', true)
on conflict (id) do nothing;

create policy "scrapbook images are public"
  on storage.objects for select
  using (bucket_id = 'scrapbook-images');

create policy "signed-in users upload scrapbook images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'scrapbook-images');
