-- Create 'covers' bucket if not exists
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

-- Allow public read access for covers
create policy "Public Access Covers"
  on storage.objects for select
  using ( bucket_id = 'covers' );
