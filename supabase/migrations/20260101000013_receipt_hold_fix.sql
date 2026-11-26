-- Fix: uploading a receipt failed with "violates check constraint appt_hold_ok".
-- The receipt step cleared hold_expires_at on a held appointment, which the database does not allow.
-- Safe to run more than once.

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

  -- Stop the expiry clock while staff check it. A held appointment must keep a hold_expires_at
  -- (check constraint appt_hold_ok), so push it to infinity instead of clearing it; expire_holds() skips it.
  update appointments set hold_expires_at = 'infinity' where id = a.id;
  perform log_appt(a.id, 'Receipt uploaded (' || case p_option when 'full' then 'full payment' else 'down payment' end
                         || ', ' || p_method || ', PHP ' || v_amount || '), waiting for staff to confirm');
  return jsonb_build_object('payment', to_jsonb(pay));
end $function$;
