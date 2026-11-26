-- Reschedules are REQUESTS that staff / the owner approve or decline.
--
-- Customer: reschedule_my_booking() now records a pending request; the appointment keeps its current time.
--           The requested slot is held (counted as busy by _slot_ok) so nobody else can book it meanwhile.
--           cancel_my_reschedule() withdraws a pending request.
-- Staff:    staff_review_reschedule() approves (re-checks the slot, then moves the appointment) or declines with a
--           reason the customer sees.
--
-- Safe to run more than once.

-- 1. Requests --------------------------------------------------------------------------------------------------
create table if not exists public.reschedule_requests (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  customer_id uuid references auth.users(id),
  old_start timestamptz not null,
  old_end timestamptz not null,
  old_tech integer references public.technicians(id),
  new_start timestamptz not null,
  new_end timestamptz not null,
  new_tech integer references public.technicians(id),
  status text not null default 'pending' check (status in ('pending','approved','declined','withdrawn')),
  reason text,
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz
);
create unique index if not exists reschedule_one_pending on public.reschedule_requests (appointment_id) where status = 'pending';
create index if not exists reschedule_pending_time on public.reschedule_requests (new_start) where status = 'pending';

alter table public.reschedule_requests enable row level security;
drop policy if exists "reschedule read own or staff" on public.reschedule_requests;
create policy "reschedule read own or staff" on public.reschedule_requests for select to authenticated
  using (customer_id = auth.uid() or public.is_staff());
-- no insert/update/delete policies: changes only go through the functions below

-- 2. Availability also respects pending requests ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._slot_ok(p_date date, p_start integer, p_dur integer, p_tech integer, p_exclude uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  s business_settings%rowtype;
  dow int := extract(dow from p_date);
  t_start timestamptz; t_end timestamptz;
  cap int; busy int;
begin
  select * into s from business_settings;
  if not (dow = any (s.open_days)) then return false; end if;
  if exists (select 1 from days_off where day = p_date) then return false; end if;
  if p_date < manila_today() or p_date > manila_today() + s.booking_window_days then return false; end if;
  if p_start < s.open_min or p_start + p_dur > s.close_min then return false; end if;
  if (p_start - s.open_min) % s.slot_step_min <> 0 then return false; end if;
  if p_start < s.lunch_end_min and s.lunch_start_min < p_start + p_dur then return false; end if;

  t_start := manila_ts(p_date, p_start);
  t_end   := manila_ts(p_date, p_start + p_dur);
  if t_start <= now() then return false; end if;

  if p_tech is not null then
    if not exists (select 1 from technicians
                   where id = p_tech and active and coalesce(day_off, -1) <> dow) then return false; end if;
    if exists (select 1 from appointments a
               where a.technician_id = p_tech and appt_blocking(a.status)
                 and (p_exclude is null or a.id <> p_exclude)
                 and tstzrange(a.start_at, a.end_at, '[)') && tstzrange(t_start, t_end, '[)')) then return false; end if;
    -- a pending reschedule request holds its requested technician/time until staff decide
    if exists (select 1 from reschedule_requests rr join appointments a on a.id = rr.appointment_id
               where rr.status = 'pending' and rr.new_tech = p_tech and appt_blocking(a.status)
                 and (p_exclude is null or rr.appointment_id <> p_exclude)
                 and tstzrange(rr.new_start, rr.new_end, '[)') && tstzrange(t_start, t_end, '[)')) then return false; end if;
  end if;

  -- salon-wide capacity: working technicians that day, limited by active stations
  select least(
           (select count(*) from technicians where active and coalesce(day_off,-1) <> dow),
           (select count(*) from stations where active)) into cap;
  select count(*) into busy from appointments a
   where appt_blocking(a.status) and (p_exclude is null or a.id <> p_exclude)
     and tstzrange(a.start_at, a.end_at, '[)') && tstzrange(t_start, t_end, '[)');
  busy := busy + (select count(*) from reschedule_requests rr join appointments a on a.id = rr.appointment_id
                   where rr.status = 'pending' and appt_blocking(a.status)
                     and (p_exclude is null or rr.appointment_id <> p_exclude)
                     and tstzrange(rr.new_start, rr.new_end, '[)') && tstzrange(t_start, t_end, '[)'));
  return busy < cap;
end $function$;

-- 3. Customer: ask to move a booking ----------------------------------------------------------------------------
create or replace function public.reschedule_my_booking(p_appt uuid, p_date date, p_start_min integer, p_tech integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  a appointments%rowtype;
  rq reschedule_requests%rowtype;
  v_dur int;
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  select * into a from appointments where id = p_appt and customer_id = uid for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not (a.status = 'confirmed'
          or (a.status = 'held' and exists (select 1 from payments p where p.appointment_id = a.id
                                            and p.provider = 'manual' and p.status = 'pending')))
    then raise exception 'NOT_RESCHEDULABLE'; end if;
  if a.start_at <= now() + interval '2 hours' then raise exception 'TOO_LATE_TO_RESCHEDULE'; end if;

  -- a new request replaces the customer's earlier pending one
  update reschedule_requests set status = 'withdrawn' where appointment_id = a.id and status = 'pending';

  v_dur := round(extract(epoch from (a.end_at - a.start_at)) / 60)::int;
  perform pg_advisory_xact_lock(hashtextextended('slots:' || p_date::text, 0));
  if not _slot_ok(p_date, p_start_min, v_dur, nullif(p_tech, 0), a.id) then raise exception 'SLOT_UNAVAILABLE'; end if;

  insert into reschedule_requests(appointment_id, customer_id, old_start, old_end, old_tech, new_start, new_end, new_tech)
  values (a.id, uid, a.start_at, a.end_at, a.technician_id,
          manila_ts(p_date, p_start_min), manila_ts(p_date, p_start_min + v_dur), nullif(p_tech, 0))
  returning * into rq;

  perform log_appt(a.id, 'Customer asked to move to '
                         || to_char(rq.new_start at time zone 'Asia/Manila', 'Mon DD, YYYY HH12:MI AM') || ', waiting for the salon');
  return jsonb_build_object('request', to_jsonb(rq));
end $function$;

-- 4. Customer: withdraw a pending request -----------------------------------------------------------------------
create or replace function public.cancel_my_reschedule(p_req uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare rq reschedule_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  select * into rq from reschedule_requests where id = p_req and customer_id = auth.uid() for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if rq.status <> 'pending' then return; end if;
  update reschedule_requests set status = 'withdrawn' where id = rq.id;
  perform log_appt(rq.appointment_id, 'Customer withdrew the reschedule request');
end $function$;

-- 5. Staff / owner: approve or decline ---------------------------------------------------------------------------
create or replace function public.staff_review_reschedule(p_req uuid, p_approve boolean, p_reason text default '')
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  rq reschedule_requests%rowtype;
  a appointments%rowtype;
  v_date date; v_min int; v_dur int;
  v_when text;
begin
  if not is_staff() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into rq from reschedule_requests where id = p_req for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if rq.status <> 'pending' then raise exception 'ALREADY_REVIEWED'; end if;
  select * into a from appointments where id = rq.appointment_id for update;
  v_when := to_char(rq.new_start at time zone 'Asia/Manila', 'Mon DD, YYYY HH12:MI AM');

  if p_approve then
    if not (a.status in ('confirmed','held')) then raise exception 'NOT_RESCHEDULABLE'; end if;
    v_date := (rq.new_start at time zone 'Asia/Manila')::date;
    v_min := extract(hour from rq.new_start at time zone 'Asia/Manila')::int * 60 + extract(minute from rq.new_start at time zone 'Asia/Manila')::int;
    v_dur := round(extract(epoch from (rq.new_end - rq.new_start)) / 60)::int;
    perform pg_advisory_xact_lock(hashtextextended('slots:' || v_date::text, 0));
    if not _slot_ok(v_date, v_min, v_dur, rq.new_tech, a.id) then raise exception 'SLOT_UNAVAILABLE'; end if;
    begin
      update appointments
         set start_at = rq.new_start, end_at = rq.new_end, technician_id = rq.new_tech, station_id = null,
             book_method = case when rq.new_tech is null then 'time' else 'tech' end
       where id = a.id;
    exception when exclusion_violation then
      raise exception 'SLOT_UNAVAILABLE';
    end;
    update reschedule_requests set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now() where id = rq.id;
    perform log_appt(a.id, 'Reschedule approved: moved from '
                           || to_char(rq.old_start at time zone 'Asia/Manila', 'Mon DD, YYYY HH12:MI AM') || ' to ' || v_when);
    perform _notify(a.customer_id, a.id, 'rescheduled', 'Your booking ' || a.code || ' has been moved to ' || v_when || '.');
  else
    if length(trim(coalesce(p_reason,''))) < 3 then raise exception 'REASON_REQUIRED'; end if;
    update reschedule_requests set status = 'declined', reason = trim(p_reason), reviewed_by = auth.uid(), reviewed_at = now()
     where id = rq.id;
    perform log_appt(a.id, 'Reschedule to ' || v_when || ' declined: ' || trim(p_reason));
    perform _notify(a.customer_id, a.id, 'reschedule_declined',
      'We could not move booking ' || a.code || ' to ' || v_when || ': ' || trim(p_reason) || '. Your original time is kept.');
  end if;
  select * into rq from reschedule_requests where id = rq.id;
  return jsonb_build_object('request', to_jsonb(rq));
end $function$;

revoke all on function public.cancel_my_reschedule(uuid) from public, anon;
grant execute on function public.cancel_my_reschedule(uuid) to authenticated;
revoke all on function public.staff_review_reschedule(uuid, boolean, text) from public, anon;
grant execute on function public.staff_review_reschedule(uuid, boolean, text) to authenticated;
revoke all on function public.reschedule_my_booking(uuid, date, integer, integer) from public, anon;
grant execute on function public.reschedule_my_booking(uuid, date, integer, integer) to authenticated;
