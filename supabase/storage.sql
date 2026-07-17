-- Room image uploads. Run in Supabase SQL editor.
insert into storage.buckets (id, name, public)
values ('room-images', 'room-images', true)
on conflict (id) do nothing;

create policy "room images are public"
  on storage.objects for select
  using (bucket_id = 'room-images');

create policy "signed-in users upload room images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'room-images');
