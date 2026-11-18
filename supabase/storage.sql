-- Storage bucket for artwork files (images / PDFs)
-- Run in SQL Editor after schema.sql, or create the bucket in
-- Dashboard -> Storage -> New bucket named "artwork" (Public bucket: ON).

insert into storage.buckets (id, name, public)
values ('artwork', 'artwork', true)
on conflict (id) do nothing;

-- Allow anyone with the anon key to upload / read artwork files.
-- (School use-case; tighten later if you need private files.)
drop policy if exists "public upload artwork" on storage.objects;
create policy "public upload artwork" on storage.objects
  for insert with check (bucket_id = 'artwork');

drop policy if exists "public read artwork" on storage.objects;
create policy "public read artwork" on storage.objects
  for select using (bucket_id = 'artwork');

drop policy if exists "public delete artwork" on storage.objects;
create policy "public delete artwork" on storage.objects
  for delete using (bucket_id = 'artwork');
