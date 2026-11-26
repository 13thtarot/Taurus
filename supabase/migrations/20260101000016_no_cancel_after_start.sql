-- Customers can't cancel a booking once its start time has passed (the salon marks it completed or no-show instead).
-- Safe to run more than once.
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
  if a.start_at <= now() then raise exception 'TOO_LATE_TO_CANCEL'; end if;
  if a.status = 'held' and exists (select 1 from payments where appointment_id = a.id and provider = 'manual' and status = 'pending')
    then raise exception 'PAYMENT_UNDER_REVIEW'; end if;
  update appointments set status = 'cancelled' where id = p_appt;
  update payments set status = 'expired' where appointment_id = p_appt and kind = 'deposit' and status = 'pending';
  perform log_appt(p_appt, case when a.status = 'held' then 'Customer cancelled before paying the deposit'
                                else 'Customer cancelled (deposit not refunded automatically)' end);
end $function$;
