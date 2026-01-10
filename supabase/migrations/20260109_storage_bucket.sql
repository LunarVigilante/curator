-- Create 'images' bucket
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do nothing;

-- Allow public read access
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'images' );

-- Note: Uploads will use service_role which bypasses RLS
