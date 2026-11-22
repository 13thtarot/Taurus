-- =====================================================================
-- Customer account rules + full price list (packages, nail art, add-ons).
-- Run on a project that already has migrations 001-009 (Supabase SQL Editor, or `supabase db push`).
-- Safe to run again: every object is created with "if not exists" / "or replace", and the price list
-- only adds what is missing and refreshes prices of services with the same name.
--
--   1. profiles: server-side validation (phone 11 digits 09XXXXXXXXX, username, name, address)
--   2. email_in_use() / username_available() checks used by the customer Account page
--   3. auth.users email change -> profiles.email kept in sync (after the user confirms the new address)
--   4. price list: categories + services with proper prices
-- =====================================================================

-- ---------------------------------------------------------------- 1. profile columns + validation
alter table profiles add column if not exists username text;
alter table profiles add column if not exists address  text;

-- One username per account (case-insensitive). Skipped with a notice if duplicates already exist.
do $$
begin
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'profiles_username_ci_key') then
    begin
      create unique index profiles_username_ci_key on profiles (lower(username)) where username is not null and username <> '';
    exception when unique_violation then
      raise notice 'profiles_username_ci_key not created: two accounts already share a username. Fix them, then run this file again.';
    end;
  end if;
end $$;

create or replace function profiles_validate() returns trigger
language plpgsql set search_path = public as $$
declare digits text;
begin
  -- PHONE: Philippine mobile, exactly 11 digits, starts with 09, numbers only.
  if tg_op = 'INSERT' then
    -- Sign-up path: tidy what we can (e.g. +63 917 123 4567 -> 09171234567) but never block account creation.
    if new.phone is not null then
      digits := regexp_replace(new.phone, '\D', '', 'g');
      if digits ~ '^639\d{9}$' then digits := '0' || substr(digits, 3); end if;
      if digits ~ '^9\d{9}$'   then digits := '0' || digits; end if;
      new.phone := case when digits ~ '^09\d{9}$' then digits else null end;
    end if;
  elsif new.phone is distinct from old.phone then
    if coalesce(new.phone, '') = '' then
      new.phone := null;
    elsif new.phone !~ '^09[0-9]{9}$' then
      raise exception 'INVALID_PHONE';
    end if;
  end if;

  -- USERNAME: 3-20 letters, numbers, dot or underscore; unique (case-insensitive).
  if new.username is distinct from (case when tg_op = 'UPDATE' then old.username end) and coalesce(new.username, '') <> '' then
    new.username := trim(new.username);
    if new.username !~ '^[A-Za-z0-9._]{3,20}$' then raise exception 'INVALID_USERNAME'; end if;
    if exists (select 1 from profiles p where lower(p.username) = lower(new.username) and p.id <> new.id) then
      raise exception 'USERNAME_TAKEN';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    -- NAME: letters (any language), spaces, . ' -   2-60 characters.
    if new.full_name is distinct from old.full_name and coalesce(new.full_name, '') <> ''
       and trim(new.full_name) !~ '^[[:alpha:] .''-]{2,60}$' then
      raise exception 'INVALID_NAME';
    end if;
    -- ADDRESS: free text but sensible length.
    if new.address is distinct from old.address and coalesce(trim(new.address), '') <> ''
       and length(trim(new.address)) not between 10 and 250 then
      raise exception 'INVALID_ADDRESS';
    end if;
    -- EMAIL: only changes through Supabase Auth (which verifies it). The sync trigger below writes it.
    -- Any other write (e.g. a booking function passing a different email) keeps the old value instead of failing.
    if new.email is distinct from old.email
       and new.email is distinct from (select u.email from auth.users u where u.id = new.id) then
      new.email := old.email;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profiles_validate on profiles;
create trigger profiles_validate before insert or update on profiles
  for each row execute function profiles_validate();

-- ---------------------------------------------------------------- 2. availability checks
-- True when ANOTHER account already uses this email (auth or profile). Signed-in users only.
create or replace function email_in_use(p_email text) returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (select 1 from auth.users u where lower(u.email) = lower(trim(p_email)) and u.id <> auth.uid())
      or exists (select 1 from profiles p where lower(p.email) = lower(trim(p_email)) and p.id <> auth.uid());
$$;
revoke all on function email_in_use(text) from public, anon;
grant execute on function email_in_use(text) to authenticated;

-- True when no OTHER account uses this username.
create or replace function username_available(p_username text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from profiles p
    where lower(p.username) = lower(trim(p_username))
      and p.id is distinct from auth.uid());
$$;
revoke all on function username_available(text) from public;
grant execute on function username_available(text) to anon, authenticated;

-- ---------------------------------------------------------------- 3. keep profiles.email = auth email
create or replace function sync_profile_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email then
    update profiles set email = new.email where id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_email_change on auth.users;
create trigger on_auth_email_change after update of email on auth.users
  for each row execute function sync_profile_email();

-- ---------------------------------------------------------------- 4. price list
-- Prices in PHP. Edit them any time in the owner portal (Hours, Services & Days Off).
-- Set replace_old := true below to also DEACTIVATE services that are not in this list (reversible: Reactivate in the owner portal).
do $$
declare
  replace_old boolean := false;
  cat_has_default boolean;
  r record;
begin
  select (c.column_default is not null or c.is_identity = 'YES') into cat_has_default
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'service_categories' and c.column_name = 'id';

  -- categories (name, note, sort_order)
  for r in select * from (values
    ('Basic Care',        null, 1),
    ('Gel Services',      null, 2),
    ('Relaxation',        null, 3),
    ('Nail Enhancements', null, 4),
    ('Packages',          'Bundles of our favourite services at a lower price than booking each one separately.', 5),
    ('Removal',           null, 6),
    ('Nail Art Add-Ons',  'Full-set designs (all 10 nails), added on top of a manicure or gel service. Final price is confirmed after the salon reviews your reference photo.', 7),
    ('Per Nail Add-Ons',  'Price per nail. Only applies if you prefer not to get a full set of nail art.', 8)
  ) as t(name, note, sort_order)
  loop
    if not exists (select 1 from service_categories where lower(name) = lower(r.name)) then
      if cat_has_default then
        insert into service_categories (name, note, sort_order) values (r.name, r.note, r.sort_order);
      else
        insert into service_categories (id, name, note, sort_order)
        values ((select coalesce(max(id), 0) + 1 from service_categories), r.name, r.note, r.sort_order);
      end if;
    elsif r.note is not null then
      update service_categories set note = coalesce(nullif(note, ''), r.note) where lower(name) = lower(r.name);
    end if;
  end loop;

  create temp table if not exists _price_list (
    cat text, name text, price numeric, price_max numeric, dmin int, dmax int, detail text, ord int
  ) on commit drop;
  truncate _price_list;
  insert into _price_list values
    -- Basic Care
    ('Basic Care','Classic Manicure',            150, null, 30, null, 'Cut, file, cuticle care and regular polish', 101),
    ('Basic Care','Classic Pedicure',            200, null, 45, null, 'Warm soak, cut, file, cuticle care and regular polish', 102),
    ('Basic Care','Classic Mani + Pedi',         330, null, 75, null, 'Classic manicure and pedicure in one visit', 103),
    ('Basic Care','Kids Manicure',               120, null, 20, null, 'Ages 12 and below, kid-safe polish', 104),
    ('Basic Care','Kids Pedicure',               150, null, 30, null, 'Ages 12 and below, kid-safe polish', 105),
    ('Basic Care','Nail Cleaning (no polish)',   100, null, 20, null, 'Cut, file and cuticle care only', 106),
    -- Gel Services
    ('Gel Services','Gel Manicure',              450, null, 60, null, 'Long-wear gel polish, lasts 2-3 weeks', 201),
    ('Gel Services','Gel Pedicure',              500, null, 60, null, 'Long-wear gel polish on toes', 202),
    ('Gel Services','Gel Mani + Pedi',           900, null,120, null, 'Gel manicure and gel pedicure together', 203),
    ('Gel Services','Gel French Manicure',       550, null, 70, null, 'Classic or coloured French tips in gel', 204),
    ('Gel Services','Cat-Eye Gel Manicure',      600, null, 70, null, 'Magnetic cat-eye gel, any colour', 205),
    -- Relaxation
    ('Relaxation','Hand Spa',                    250, null, 30, null, 'Scrub, mask and hand massage', 301),
    ('Relaxation','Footspa',                     350, null, 45, null, 'Foot soak, scrub, callus care, mask and massage', 302),
    ('Relaxation','Paraffin Wax Treatment',      300, null, 30, null, 'Hands or feet; deep moisture for dry skin', 303),
    ('Relaxation','Hand & Foot Massage',         200, null, 20, null, '20-minute relaxing massage', 304),
    -- Nail Enhancements
    ('Nail Enhancements','Soft Gel Extensions',  1000, 1300, 90, 120, 'Full set, length and shape of your choice; plain gel colour included', 401),
    ('Nail Enhancements','BIAB Builder Gel Overlay', 800, null, 75, null, 'Strengthens natural nails; gel colour included', 402),
    ('Nail Enhancements','Polygel Extensions',   1100, 1400,100, 130, 'Light, durable extensions; gel colour included', 403),
    ('Nail Enhancements','Extension Refill',     600, null, 60, null, 'Within 3 weeks of your last set', 404),
    -- Packages
    ('Packages','Self-Care Package',             849, null, 120, null, 'Includes: Classic Manicure + Classic Pedicure + Hand Spa + Footspa (save ₱101)', 501),
    ('Packages','Pamper Package',                899, null, 135, null, 'Includes: Gel Manicure + Classic Pedicure + Footspa (save ₱101)', 502),
    ('Packages','Glam Package',                  999, null, 150, null, 'Includes: Gel Manicure + Gel Pedicure + Simple Nail Art (save ₱151)', 503),
    ('Packages','Luxury Package',                1899, 2199, 180, 210, 'Includes: Soft Gel Extensions + Gel Pedicure + Footspa + Paraffin (save ₱251)', 504),
    ('Packages','Kids Glam Package',             299, null, 50, null, 'Includes: Kids Manicure + Kids Pedicure + glitter accent (ages 12 and below)', 505),
    -- Removal
    ('Removal','Gel Polish Removal',             150, null, 20, null, 'Waived when you get a new gel set on the same visit', 601),
    ('Removal','Extension Removal',              250, null, 30, null, 'Safe soak-off of soft gel, polygel or acrylic', 602),
    -- Nail Art Add-Ons (full set)
    ('Nail Art Add-Ons','Simple Nail Art',       200, null, 15, null, 'Lines, dots, minimal accents', 701),
    ('Nail Art Add-Ons','Chrome / Mirror Powder',250, null, 15, null, 'Mirror, pearl or aurora chrome', 702),
    ('Nail Art Add-Ons','Ombre / Gradient',      300, null, 20, null, 'Soft colour fade', 703),
    ('Nail Art Add-Ons','French Tip Design',     200, null, 15, null, 'Classic, coloured or micro French', 704),
    ('Nail Art Add-Ons','Hand-Painted Design',   300,  800, 30,  60, 'Price depends on detail; confirmed from your reference photo', 705),
    ('Nail Art Add-Ons','3D Florals',            400,  900, 30,  60, 'Sculpted 3D gel flowers', 706),
    ('Nail Art Add-Ons','Custom / Character Design', 500, 1200, 45, 90, 'Fully custom art from your reference', 707),
    -- Per Nail Add-Ons
    ('Per Nail Add-Ons','Rhinestones (per nail)',      20, null, 5, null, 'Crystals or pearls', 801),
    ('Per Nail Add-Ons','Chrome Accent (per nail)',    25, null, 5, null, 'One chrome accent nail', 802),
    ('Per Nail Add-Ons','Charms / 3D Embellishment (per nail)', 40, null, 5, null, 'Metal charms, bows, studs', 803),
    ('Per Nail Add-Ons','Hand-Painted Accent (per nail)',       50, null, 10, null, 'One hand-painted accent nail', 804),
    ('Per Nail Add-Ons','3D Flower (per nail)',        60, null, 10, null, 'One sculpted 3D gel flower', 805),
    ('Per Nail Add-Ons','Sticker / Decal (per nail)',  15, null, 5, null, 'Nail sticker or water decal', 806);

  for r in select pl.*, c.id as cat_id from _price_list pl join service_categories c on lower(c.name) = lower(pl.cat) order by pl.ord
  loop
    update services set price = r.price, price_max = r.price_max, duration_min = r.dmin, duration_max = r.dmax,
                        detail = coalesce(nullif(detail, ''), r.detail), category_id = r.cat_id, active = true
    where lower(name) = lower(r.name);
    if not found then
      insert into services (category_id, name, price, price_max, duration_min, duration_max, detail, active, sort_order)
      values (r.cat_id, r.name, r.price, r.price_max, r.dmin, r.dmax, r.detail, true, r.ord);
    end if;
  end loop;

  if replace_old then
    update services s set active = false
    where not exists (select 1 from _price_list pl where lower(pl.name) = lower(s.name));
  end if;
end $$;
