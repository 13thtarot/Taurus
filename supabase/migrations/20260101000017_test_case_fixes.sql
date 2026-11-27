-- Fixes from the test cases.
--   TC-01  Down payment is capped at the booking's estimated total (a P120 service is charged P120, not P250).
--   TC-02  Nail art / add-ons can't be booked on their own: the booking needs a base service.
--   TC-12  Receipts can also be PDFs, up to 10 MB.
--   TC-13  Customers get 15 minutes (not 5) to pay and upload the receipt.
--   TC-15 / TC-21  Salon contact details (address, phone, email, Facebook, Instagram) the owner can edit.
-- Safe to run more than once.

-- 1. 15 minutes to pay and upload the receipt -----------------------------------------------------------------------
update public.business_settings set hold_minutes = 15 where id;

-- 2. Salon contact details shown in the footer, About page and after a receipt is sent ------------------------------
alter table public.business_settings
  add column if not exists salon_address   text not null default '',
  add column if not exists salon_phone     text not null default '',
  add column if not exists salon_email     text not null default '',
  add column if not exists salon_facebook  text not null default '',
  add column if not exists salon_instagram text not null default '';
update public.business_settings set salon_address = 'Quezon City, Metro Manila' where id and salon_address = '';
update public.business_settings set salon_instagram = 'fairytalenails' where id and salon_instagram = '';

-- 3. Receipts: JPG / PNG / WEBP / HEIC photos or a PDF, up to 10 MB ---------------------------------------------------
update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf']
 where id = 'payment-receipts';

-- 4. Bookings: base service required, down payment capped at the estimated total -------------------------------------
CREATE OR REPLACE FUNCTION public.create_booking_hold(p_service_ids integer[], p_date date, p_start_min integer, p_tech integer, p_method text, p_name text, p_phone text, p_email text, p_notes text, p_idem text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  s business_settings%rowtype;
  existing appointments%rowtype;
  v_dur int; v_price numeric; v_n int;
  a appointments%rowtype;
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_idem is null or length(p_idem) < 8 then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  if coalesce(array_length(p_service_ids,1),0) not between 1 and 8 then raise exception 'INVALID_SERVICES'; end if;
  if length(trim(coalesce(p_name,''))) < 2 or length(regexp_replace(coalesce(p_phone,''),'\D','','g')) < 7
     or p_email !~ '^\S+@\S+\.\S+$' then raise exception 'INVALID_CONTACT'; end if;

  -- idempotent replay: same customer + key returns the same appointment
  select * into existing from appointments where customer_id = uid and idempotency_key = p_idem;
  if found then
    return jsonb_build_object('appointment', to_jsonb(existing), 'replayed', true);
  end if;

  perform expire_holds();
  select * into s from business_settings;

  select count(*) into v_n from appointments where customer_id = uid and status = 'held';
  if v_n >= 3 then raise exception 'TOO_MANY_HOLDS'; end if;

  select count(*), coalesce(sum(coalesce(duration_max, duration_min)),0), coalesce(sum(price),0)
    into v_n, v_dur, v_price
    from services where id = any (p_service_ids) and active;
  if v_n <> (select count(distinct x) from unnest(p_service_ids) x) then raise exception 'INVALID_SERVICES'; end if;
  if not exists (select 1 from services sv join service_categories c on c.id = sv.category_id
                 where sv.id = any (p_service_ids) and c.name !~* 'add-on') then raise exception 'BASE_SERVICE_REQUIRED'; end if;

  -- serialise all booking attempts for the same calendar day
  perform pg_advisory_xact_lock(hashtextextended('slots:' || p_date::text, 0));

  if not _slot_ok(p_date, p_start_min, v_dur, p_tech) then raise exception 'SLOT_UNAVAILABLE'; end if;

  begin
    insert into appointments(code, customer_id, customer_name, customer_phone, customer_email, notes,
                             book_method, start_at, end_at, technician_id, status, hold_expires_at,
                             est_subtotal, deposit_required, idempotency_key, created_by)
    values ('FN-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,7)), uid, trim(p_name), trim(p_phone),
            trim(p_email), left(coalesce(p_notes,''),500), p_method,
            manila_ts(p_date, p_start_min), manila_ts(p_date, p_start_min + v_dur), p_tech,
            'held', now() + make_interval(mins => s.hold_minutes), v_price,
            case when v_price > 0 then least(s.deposit_amount, v_price) else s.deposit_amount end, p_idem, uid)
    returning * into a;
  exception when exclusion_violation then
    raise exception 'SLOT_UNAVAILABLE';
  end;

  insert into appointment_items(appointment_id, service_id, name, category, unit_price, price_max, duration_min, duration_max)
  select a.id, sv.id, sv.name, c.name, sv.price, sv.price_max, sv.duration_min, sv.duration_max
  from services sv join service_categories c on c.id = sv.category_id
  where sv.id = any (p_service_ids);

  perform log_appt(a.id, 'Booked online (' || coalesce(p_method,'?') || '), slot held for deposit', 'Customer: ' || trim(p_name));
  return jsonb_build_object('appointment', to_jsonb(a), 'replayed', false);
end $function$;

-- bookings still waiting for payment get the same cap
update public.appointments set deposit_required = est_subtotal
 where status = 'held' and est_subtotal > 0 and deposit_required > est_subtotal;

-- 5. Receipt amounts: full payment = the estimated total, down payment = the capped deposit ----------------------------
create or replace function public.submit_payment_receipt(p_appt uuid, p_option text, p_method text, p_path text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  a appointments%rowtype;
  pay payments%rowtype;
  v_amount numeric;
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_option not in ('down','full') then raise exception 'INVALID_OPTION'; end if;
  if p_method not in ('gcash','maya') then raise exception 'INVALID_METHOD'; end if;
  if p_path is null or p_path not like uid::text || '/%' then raise exception 'INVALID_RECEIPT'; end if;

  perform expire_holds();
  select * into a from appointments where id = p_appt and customer_id = uid for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if a.status <> 'held' then raise exception 'HOLD_EXPIRED'; end if;

  v_amount := case
                when a.est_subtotal <= 0 then a.deposit_required
                when p_option = 'full' then a.est_subtotal
                else least(a.deposit_required, a.est_subtotal)
              end;

  -- Re-upload while still waiting: replace the receipt on the same pending payment.
  select * into pay from payments
   where appointment_id = a.id and provider = 'manual' and status = 'pending' and kind = 'deposit'
   for update;
  if found then
    update payments set receipt_path = p_path, pay_option = p_option, method = p_method, amount = v_amount, created_at = now()
     where id = pay.id returning * into pay;
  else
    insert into payments(appointment_id, kind, method, provider, amount, status, idempotency_key, receipt_path, pay_option)
    values (a.id, 'deposit', p_method, 'manual', v_amount, 'pending', 'rcpt:' || a.id || ':' || gen_random_uuid(), p_path, p_option)
    returning * into pay;
  end if;

  -- Stop the expiry clock while staff check it (a held appointment must keep a hold_expires_at, so use infinity).
  update appointments set hold_expires_at = 'infinity' where id = a.id;
  perform log_appt(a.id, 'Receipt uploaded (' || case p_option when 'full' then 'full payment' else 'down payment' end
                         || ', ' || p_method || ', PHP ' || v_amount || '), waiting for staff to confirm');
  return jsonb_build_object('payment', to_jsonb(pay));
end $function$;

revoke all on function public.submit_payment_receipt(uuid, text, text, text) from public, anon;
grant execute on function public.submit_payment_receipt(uuid, text, text, text) to authenticated;
