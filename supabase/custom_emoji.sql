-- Per-user custom emoji uploads. Run in Supabase SQL editor.

create table if not exists public.custom_emojis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 32),
  image_url text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.custom_emojis enable row level security;

create policy "users view their own custom emojis" on public.custom_emojis
  for select to authenticated using (user_id = auth.uid());
create policy "users add their own custom emojis" on public.custom_emojis
  for insert to authenticated with check (user_id = auth.uid());
create policy "users delete their own custom emojis" on public.custom_emojis
  for delete to authenticated using (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('custom-emojis', 'custom-emojis', true)
on conflict (id) do nothing;

create policy "custom emojis are public"
  on storage.objects for select
  using (bucket_id = 'custom-emojis');

create policy "signed-in users upload custom emojis"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'custom-emojis');
