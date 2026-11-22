-- Receipt-upload payments (replaces PayMongo / test-mode deposits).
--
-- Flow:
--   1. create_booking_hold() reserves the slot as 'held' with hold_expires_at = now() + hold_minutes (set to 5 below).
--   2. The customer pays by GCash / Maya outside the site and uploads a screenshot of the receipt.
--      submit_payment_receipt() stores a 'pending' manual payment and STOPS the expiry clock (hold_expires_at = null),
--      so the slot stays reserved while staff check it. The customer sees "Waiting for confirmation".
--   3. If no receipt arrives in time, the existing every-minute cron job (expire_holds) expires the hold as before.
--   4. Staff open the receipt and call staff_review_payment(): approve -> payment 'paid', appointment 'confirmed';
--      reject -> payment 'failed', appointment 'cancelled', slot released, customer notified with the reason.
--
-- A full payment is stored as the 'deposit' kind with the full estimated amount, so the existing invoice logic
-- (_deposit_paid -> deposit_applied) deducts it from the final bill automatically.
--
-- Safe to run more than once.

-- 1. Salon payment details shown to customers (owner edits these in the owner portal) ------------------------------
alter table public.business_settings
  add column if not exists pay_gcash_name   text not null default '',
  add column if not exists pay_gcash_number text not null default '',
  add column if not exists pay_maya_name    text not null default '',
  add column if not exists pay_maya_number  text not null default '',
  add column if not exists pay_qr_path      text,           -- QR image in the public 'salon-gallery' bucket
  add column if not exists pay_note         text not null default '';

-- 5 minutes to pay and upload the receipt.
update public.business_settings set hold_minutes = 5 where id;

-- 2. Receipt + review details on each payment ---------------------------------------------------------------------
alter table public.payments
  add column if not exists receipt_path  text,             -- object path in the private 'payment-receipts' bucket
  add column if not exists pay_option    text check (pay_option in ('down','full')),
  add column if not exists reviewed_by   uuid references auth.users(id),
  add column if not exists reviewed_at   timestamptz,
  add column if not exists reject_reason text;

create index if not exists payments_pending_receipts_idx
  on public.payments (created_at) where provider = 'manual' and status = 'pending' and receipt_path is not null;

-- 3. Private storage bucket for receipts: customers upload into their own folder; customer + staff can read ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-receipts', 'payment-receipts', false, 5242880, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;

drop policy if exists "receipts upload own folder" on storage.objects;
create policy "receipts upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-receipts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "receipts read own or staff" on storage.objects;
create policy "receipts read own or staff" on storage.objects for select to authenticated
  using (bucket_id = 'payment-receipts' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));

-- 4. Customer: submit (or replace) the receipt for a held appointment ---------------------------------------------
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

  v_amount := case when p_option = 'full' then greatest(a.est_subtotal, a.deposit_required) else a.deposit_required end;

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

  update appointments set hold_expires_at = null where id = a.id;   -- stop the expiry clock while staff check it
  perform log_appt(a.id, 'Receipt uploaded (' || case p_option when 'full' then 'full payment' else 'down payment' end
                         || ', ' || p_method || ', PHP ' || v_amount || '), waiting for staff to confirm');
  return jsonb_build_object('payment', to_jsonb(pay));
end $function$;

-- 5. Staff / owner: approve or reject a receipt -------------------------------------------------------------------
create or replace function public.staff_review_payment(p_payment uuid, p_approve boolean, p_reason text default '')
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  pay payments%rowtype;
  a appointments%rowtype;
begin
  if not is_staff() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into pay from payments where id = p_payment for update;
  if not found or pay.provider <> 'manual' then raise exception 'NOT_FOUND'; end if;
  if pay.status <> 'pending' then raise exception 'ALREADY_REVIEWED'; end if;
  select * into a from appointments where id = pay.appointment_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;

  if p_approve then
    if a.status <> 'held' then raise exception 'NOT_AWAITING_PAYMENT'; end if;
    update payments set status = 'paid', paid_at = now(), received_by = auth.uid(), reviewed_by = auth.uid(), reviewed_at = now()
     where id = pay.id returning * into pay;
    update appointments set status = 'confirmed', hold_expires_at = null where id = a.id;
    perform log_appt(a.id, 'Payment of PHP ' || pay.amount || ' verified, booking confirmed');
    perform _notify(a.customer_id, a.id, 'confirmed', 'Payment received. Your booking ' || a.code || ' is confirmed.');
  else
    if length(trim(coalesce(p_reason,''))) < 3 then raise exception 'REASON_REQUIRED'; end if;
    update payments set status = 'failed', reviewed_by = auth.uid(), reviewed_at = now(), reject_reason = trim(p_reason)
     where id = pay.id returning * into pay;
    if a.status = 'held' then
      update appointments set status = 'cancelled', hold_expires_at = null where id = a.id;
    end if;
    perform log_appt(a.id, 'Payment rejected: ' || trim(p_reason) || '. Booking cancelled');
    perform _notify(a.customer_id, a.id, 'cancelled',
      'We could not confirm your payment for booking ' || a.code || ': ' || trim(p_reason) || '. Please book again or contact the salon.');
  end if;
  return jsonb_build_object('payment', to_jsonb(pay));
end $function$;

revoke all on function public.submit_payment_receipt(uuid, text, text, text) from public, anon;
grant execute on function public.submit_payment_receipt(uuid, text, text, text) to authenticated;
revoke all on function public.staff_review_payment(uuid, boolean, text) from public, anon;
grant execute on function public.staff_review_payment(uuid, boolean, text) to authenticated;

-- 6. Customers must not cancel a booking whose receipt staff are checking (the money is already sent).
create or replace function public.cancel_my_booking(p_appt uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare a appointments%rowtype;
begin
  select * into a from appointments where id = p_appt and customer_id = auth.uid() for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if a.status not in ('held','confirmed') then raise exception 'NOT_CANCELLABLE'; end if;
  if a.status = 'held' and exists (select 1 from payments where appointment_id = a.id and provider = 'manual' and status = 'pending')
    then raise exception 'PAYMENT_UNDER_REVIEW'; end if;
  update appointments set status = 'cancelled' where id = p_appt;
  update payments set status = 'expired' where appointment_id = p_appt and kind = 'deposit' and status = 'pending';
  perform log_appt(p_appt, case when a.status = 'held' then 'Customer cancelled before paying the deposit'
                                else 'Customer cancelled (deposit not refunded automatically)' end);
end $function$;
