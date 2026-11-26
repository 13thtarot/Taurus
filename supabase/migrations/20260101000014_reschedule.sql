-- Customers can move their own booking to another free date/time (and technician) instead of cancelling.
--
-- Rules:
--   * only the customer's own booking, while it is Confirmed or Waiting for confirmation (receipt sent)
--   * not within 2 hours of the current start time (call the salon instead)
--   * the new slot is checked with the same rules as a new booking (_slot_ok, excluding this appointment)
--   * payment, services and booking number stay the same; the change is written to the appointment history
--
-- Safe to run more than once.

create or replace function public.reschedule_my_booking(p_appt uuid, p_date date, p_start_min integer, p_tech integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  a appointments%rowtype;
  v_dur int;
  v_old text;
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  select * into a from appointments where id = p_appt and customer_id = uid for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not (a.status = 'confirmed'
          or (a.status = 'held' and exists (select 1 from payments p where p.appointment_id = a.id
                                            and p.provider = 'manual' and p.status = 'pending')))
    then raise exception 'NOT_RESCHEDULABLE'; end if;
  if a.start_at <= now() + interval '2 hours' then raise exception 'TOO_LATE_TO_RESCHEDULE'; end if;

  v_dur := round(extract(epoch from (a.end_at - a.start_at)) / 60)::int;
  perform pg_advisory_xact_lock(hashtextextended('slots:' || p_date::text, 0));
  if not _slot_ok(p_date, p_start_min, v_dur, nullif(p_tech, 0), a.id) then raise exception 'SLOT_UNAVAILABLE'; end if;

  v_old := to_char(a.start_at at time zone 'Asia/Manila', 'Mon DD, YYYY HH12:MI AM');
  begin
    update appointments
       set start_at = manila_ts(p_date, p_start_min),
           end_at = manila_ts(p_date, p_start_min + v_dur),
           technician_id = nullif(p_tech, 0),
           station_id = null,
           book_method = case when nullif(p_tech, 0) is null then 'time' else 'tech' end
     where id = a.id
     returning * into a;
  exception when exclusion_violation then
    raise exception 'SLOT_UNAVAILABLE';
  end;

  perform log_appt(a.id, 'Customer rescheduled from ' || v_old || ' to '
                         || to_char(a.start_at at time zone 'Asia/Manila', 'Mon DD, YYYY HH12:MI AM'));
  return jsonb_build_object('appointment', to_jsonb(a));
end $function$;

revoke all on function public.reschedule_my_booking(uuid, date, integer, integer) from public, anon;
grant execute on function public.reschedule_my_booking(uuid, date, integer, integer) to authenticated;
