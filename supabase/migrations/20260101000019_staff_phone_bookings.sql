-- Staff / owner book appointments for customers who call or message the salon.
--   * The booking is confirmed right away and paid at the salon (no online down payment).
--   * Same rules as online bookings: free time slot (technician, lunch break, closing time, capacity),
--     active services, and nail art / add-ons need a base service.
--   * It can be linked to the customer's account (it then shows in their My Appointments and they get an update),
--     or just recorded with a name and mobile number.
-- Safe to run more than once.

create or replace function public.staff_create_booking(
  p_service_ids integer[], p_date date, p_start_min integer, p_tech integer,
  p_name text, p_phone text, p_email text, p_notes text, p_customer uuid, p_idem text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  s business_settings%rowtype;
  a appointments%rowtype;
  v_dur int; v_price numeric; v_n int;
  v_tech int := nullif(p_tech, 0);
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if not is_staff() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_idem is null or length(p_idem) < 8 then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;

  -- a double click or retry returns the same booking
  select * into a from appointments where created_by = auth.uid() and idempotency_key = 'staff:' || p_idem;
  if found then return jsonb_build_object('appointment', to_jsonb(a), 'replayed', true); end if;

  if coalesce(array_length(p_service_ids, 1), 0) not between 1 and 8 then raise exception 'INVALID_SERVICES'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'NAME_REQUIRED'; end if;
  if v_phone !~ '^09\d{9}$' then raise exception 'INVALID_PHONE'; end if;
  if v_email <> '' and v_email !~ '^\S+@\S+\.\S+$' then raise exception 'INVALID_EMAIL'; end if;
  if p_customer is not null and not exists (select 1 from user_roles where user_id = p_customer and role = 'customer')
    then raise exception 'NOT_A_CUSTOMER'; end if;

  perform expire_holds();
  select * into s from business_settings;

  select count(*), coalesce(sum(coalesce(duration_max, duration_min)), 0), coalesce(sum(price), 0)
    into v_n, v_dur, v_price
    from services where id = any (p_service_ids) and active;
  if v_n <> (select count(distinct x) from unnest(p_service_ids) x) then raise exception 'INVALID_SERVICES'; end if;
  if not exists (select 1 from services sv join service_categories c on c.id = sv.category_id
                 where sv.id = any (p_service_ids) and c.name !~* 'add-on') then raise exception 'BASE_SERVICE_REQUIRED'; end if;

  -- same lock and checks as online bookings, so two people can't take the same slot
  perform pg_advisory_xact_lock(hashtextextended('slots:' || p_date::text, 0));
  if not _slot_ok(p_date, p_start_min, v_dur, v_tech) then raise exception 'SLOT_UNAVAILABLE'; end if;

  begin
    insert into appointments(code, customer_id, customer_name, customer_phone, customer_email, notes, book_method,
                             start_at, end_at, technician_id, status, est_subtotal, deposit_required,
                             idempotency_key, created_by)
    values ('FN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 7)), p_customer, trim(p_name), v_phone,
            v_email, left(coalesce(p_notes, ''), 500), case when v_tech is null then 'time' else 'tech' end,
            manila_ts(p_date, p_start_min), manila_ts(p_date, p_start_min + v_dur), v_tech, 'confirmed',
            v_price, 0, 'staff:' || p_idem, auth.uid())
    returning * into a;
  exception when exclusion_violation then
    raise exception 'SLOT_UNAVAILABLE';
  end;

  insert into appointment_items(appointment_id, service_id, name, category, unit_price, price_max, duration_min, duration_max)
  select a.id, sv.id, sv.name, c.name, sv.price, sv.price_max, sv.duration_min, sv.duration_max
  from services sv join service_categories c on c.id = sv.category_id
  where sv.id = any (p_service_ids);

  perform log_appt(a.id, 'Booked by the salon for the customer (phone / message), to be paid at the salon');
  perform _notify(p_customer, a.id, 'confirmed',
    'The salon booked ' || a.code || ' for you on ' || to_char(a.start_at at time zone 'Asia/Manila', 'Mon DD, YYYY HH12:MI AM') || '.');
  return jsonb_build_object('appointment', to_jsonb(a), 'replayed', false);
end $function$;

revoke all on function public.staff_create_booking(integer[], date, integer, integer, text, text, text, text, uuid, text) from public, anon;
grant execute on function public.staff_create_booking(integer[], date, integer, integer, text, text, text, text, uuid, text) to authenticated;
