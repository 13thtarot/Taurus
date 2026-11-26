-- Appointments are completed by staff / the owner, not automatically by payment.
--
-- Before: paying the final bill (or creating an invoice already covered by the down/full payment) set the
-- appointment to 'completed' straight away, even if the service was still going on.
-- After:  paying only marks the BILL as paid (receipt issued). The appointment stays 'service' (In service)
--         until staff press "Mark as completed", which is only allowed once the bill is fully paid.
--
-- Safe to run more than once.

-- 1. Paying the bill no longer completes the appointment.
create or replace function public._finalize_sale_if_paid(p_sale uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare s sales%rowtype;
begin
  select * into s from sales where id = p_sale for update;
  if not found or s.status <> 'open' then return; end if;
  if s.balance_due - _balance_paid(p_sale) > 0 then return; end if;

  update sales set status = 'paid', paid_at = now(),
         receipt_no = 'FN-' || to_char(now() at time zone 'Asia/Manila','YYYYMMDD') || '-' || lpad(nextval('receipt_seq')::text, 5, '0')
   where id = p_sale;
  perform log_appt(s.appointment_id, 'Payment complete, receipt issued', 'System');
  perform _notify(s.customer_id, s.appointment_id, 'receipt', 'Thank you! Your payment is complete. Receipt is available in your account.');
end $function$;

-- 2. Staff / owner mark the appointment as completed once the service is done and the bill is paid.
create or replace function public.staff_complete_appointment(p_appt uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare a appointments%rowtype; s sales%rowtype;
begin
  if not is_staff() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into a from appointments where id = p_appt for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if a.status = 'completed' then return; end if;                       -- already done (double click)
  if a.status <> 'service' then raise exception 'NOT_IN_SERVICE'; end if;
  select * into s from sales where appointment_id = a.id;
  if not found then raise exception 'BILL_FIRST'; end if;
  if s.status <> 'paid' then raise exception 'BALANCE_DUE'; end if;

  update appointments set status = 'completed' where id = a.id;
  perform log_appt(a.id, 'Marked as completed');
  perform _notify(a.customer_id, a.id, 'completed', 'Thank you for visiting Fairytale Nails Salon! We hope to see you again soon.');
end $function$;

revoke all on function public.staff_complete_appointment(uuid) from public, anon;
grant execute on function public.staff_complete_appointment(uuid) to authenticated;

-- 3. A fully refunded bill also closes an appointment that was paid but not yet marked completed.
CREATE OR REPLACE FUNCTION public._apply_refund_effects(p_refund uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r refunds%rowtype; pay payments%rowtype; done numeric; tot_paid numeric; tot_ref numeric; appt uuid;
begin
  select * into r from refunds where id = p_refund;
  select * into pay from payments where id = r.payment_id for update;
  select coalesce(sum(amount),0) into done from refunds where payment_id = pay.id and status = 'succeeded';
  update payments set status = (case when done >= pay.amount then 'refunded' else 'partially_refunded' end)::payment_state where id = pay.id;
  appt := coalesce(pay.appointment_id, r.appointment_id);
  if r.sale_id is not null then
    select coalesce(sum(p.amount),0) into tot_paid from payments p
      where (p.sale_id = r.sale_id or (p.appointment_id = appt and p.kind = 'deposit'))
        and p.status in ('paid','partially_refunded','refunded');
    select coalesce(sum(f.amount),0) into tot_ref from refunds f join payments p on p.id = f.payment_id
      where (p.sale_id = r.sale_id or (p.appointment_id = appt and p.kind = 'deposit')) and f.status = 'succeeded';
    update sales set status = (case when tot_ref >= tot_paid then 'refunded' else 'partially_refunded' end)::sale_state where id = r.sale_id;
    if tot_ref >= tot_paid then update appointments set status = 'refunded' where id = appt and status in ('completed','service'); end if;
  end if;
  perform log_appt(appt, 'Refund of PHP ' || r.amount || ' completed: ' || r.reason);
end $function$;
