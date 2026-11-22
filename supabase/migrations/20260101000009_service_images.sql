-- Optional picture per service (shown in the customer's service list and booking screens).
-- Files live in the public "salon-gallery" bucket under services/ (created by 20260101000008_gallery.sql: run that first).
-- A service without a picture keeps its generated illustration. Safe to run again.
alter table services add column if not exists image_path text;
