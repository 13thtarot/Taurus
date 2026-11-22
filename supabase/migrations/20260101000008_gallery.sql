-- =====================================================================
-- Owner-managed gallery photos. The customer site's Gallery page reads this table; the owner portal edits it.
-- Photos live in a PUBLIC storage bucket (only the owner can upload/replace/delete).
-- Seeded with the 7 photos that ship in web/img/ (default_key), so the gallery works before any upload.
-- Run on a project that already has migrations 001-007. Safe to run again (policies are dropped and recreated).
-- =====================================================================
create table if not exists gallery_images (
  id           bigserial primary key,
  title        text not null check (length(trim(title)) between 1 and 60),
  storage_path text,                                    -- file inside the salon-gallery bucket
  default_key  text,                                    -- bundled fallback: web/img/<default_key>.jpg
  focus        text not null default 'center' check (focus in ('top','center','bottom')),
  sort_order   int  not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  check (storage_path is not null or default_key is not null)
);
alter table gallery_images enable row level security;
drop policy if exists "gallery read" on gallery_images;
create policy "gallery read"        on gallery_images for select using (active or is_owner());
drop policy if exists "gallery owner write" on gallery_images;
create policy "gallery owner write" on gallery_images for all    using (is_owner()) with check (is_owner());
grant select on gallery_images to anon, authenticated;
grant insert, update, delete on gallery_images to authenticated;
grant usage, select on sequence gallery_images_id_seq to authenticated;

insert into gallery_images (title, default_key, sort_order)
select t.title, t.k, t.n from (values
  ('3D florals','florals',1), ('Dark embellished','dark',2), ('Lace & florals','lace',3), ('Emerald & gold','emerald',4),
  ('Deep blue','blue',5), ('Fruit salad','fruit',6), ('Star nails','star',7)) as t(title,k,n)
where not exists (select 1 from gallery_images);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('salon-gallery', 'salon-gallery', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "gallery files owner insert" on storage.objects;
create policy "gallery files owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'salon-gallery' and is_owner());
drop policy if exists "gallery files owner update" on storage.objects;
create policy "gallery files owner update" on storage.objects for update to authenticated
  using (bucket_id = 'salon-gallery' and is_owner());
drop policy if exists "gallery files owner delete" on storage.objects;
create policy "gallery files owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'salon-gallery' and is_owner());
