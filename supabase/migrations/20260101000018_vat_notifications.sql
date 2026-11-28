-- 1. Bills are VAT-inclusive: a P120 service costs P120 in total (P12.86 of it is VAT), instead of P134.40.
--    Bills already created keep their amounts; new and edited bills use the listed price as the total.
-- 2. Customers can see their notifications (payment confirmed / rejected, reschedule approved / declined, receipt ready).
-- 3. Live updates for notifications and reschedule requests (for the customer bell and the staff menu counts).
-- Safe to run more than once.

-- 1. VAT-inclusive bills ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_invoice(p_appt uuid, p_walkin_name text, p_lines jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  st business_settings%rowtype; a appointments%rowtype; s sales%rowtype;
  ln jsonb; sv services%rowtype; tc technicians%rowtype;
  v_price numeric; v_sub numeric := 0; v_tax numeric; v_tot numeric; v_dep numeric := 0;
  v_dur int := 0; appt_id uuid := p_appt;
begin
  if not is_staff() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'NO_LINES'; end if;
  select * into st from business_settings;

  if appt_id is null then
    if length(trim(coalesce(p_walkin_name,''))) < 2 then raise exception 'NAME_REQUIRED'; end if;
    insert into appointments(code, customer_name, book_method, start_at, end_at, status, is_walkin, created_by)
    values ('FN-W' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,5)), trim(p_walkin_name), 'walkin',
            date_trunc('minute', now()), date_trunc('minute', now()) + interval '30 minutes', 'service', true, auth.uid())
    returning id into appt_id;
  end if;

  select * into a from appointments where id = appt_id for update;
  if not found or a.status not in ('confirmed','waiting','service') then raise exception 'NOT_BILLABLE'; end if;

  select * into s from sales where appointment_id = appt_id for update;
  if found then
    if s.status <> 'open' or _balance_paid(s.id) > 0 then raise exception 'INVOICE_LOCKED'; end if;
    delete from sale_items where sale_id = s.id;
  end if;

  -- compute lines first
  create temp table if not exists _il (service_id int, name text, price numeric, dur int, tech int, tname text, rate numeric) on commit drop;
  truncate _il;
  for ln in select * from jsonb_array_elements(p_lines) loop
    select * into sv from services where id = (ln->>'service_id')::int;
    if not found then raise exception 'INVALID_SERVICE'; end if;
    select * into tc from technicians where id = (ln->>'technician_id')::int;
    if not found then raise exception 'TECHNICIAN_REQUIRED'; end if;
    v_price := coalesce((ln->>'unit_price')::numeric, sv.price);
    if v_price < sv.price or v_price > coalesce(sv.price_max, sv.price) then raise exception 'PRICE_OUT_OF_RANGE'; end if;
    insert into _il values (sv.id, sv.name, v_price, coalesce(sv.duration_max, sv.duration_min), tc.id, tc.name, tc.commission_rate);
    v_sub := v_sub + v_price; v_dur := v_dur + coalesce(sv.duration_max, sv.duration_min);
  end loop;

  -- Listed prices already include VAT: the total is the listed price, and the VAT inside it is recorded separately.
  v_tot := v_sub;
  v_tax := round(v_sub - v_sub / (1 + st.tax_rate), 2);
  v_dep := least(_deposit_paid(appt_id), v_tot);

  if s.id is null then
    insert into sales(appointment_id, customer_id, customer_name, subtotal, tax_rate, tax_amount, total, deposit_applied, balance_due, created_by)
    values (appt_id, a.customer_id, a.customer_name, v_sub, st.tax_rate, v_tax, v_tot, v_dep, v_tot - v_dep, auth.uid())
    returning * into s;
  else
    update sales set subtotal = v_sub, tax_rate = st.tax_rate, tax_amount = v_tax, total = v_tot,
           deposit_applied = v_dep, balance_due = v_tot - v_dep where id = s.id returning * into s;
  end if;

  insert into sale_items(sale_id, service_id, name, unit_price, duration_min, technician_id, technician_name, commission_rate)
  select s.id, service_id, name, price, dur, tech, tname, rate from _il;

  update appointments set status = 'service' where id = appt_id and status in ('confirmed','waiting');
  perform log_appt(appt_id, 'Invoice generated: total PHP ' || v_tot || ', deposit applied PHP ' || v_dep || ', balance PHP ' || (v_tot - v_dep));

  if s.balance_due = 0 then perform _finalize_sale_if_paid(s.id); end if;
  select * into s from sales where id = s.id;
  return to_jsonb(s);
end $function$;

-- 2. Notifications: read flag + "mark all as read" for the signed-in customer --------------------------------------
alter table public.notifications add column if not exists created_at timestamptz not null default now();
alter table public.notifications add column if not exists read_at timestamptz;

create or replace function public.mark_my_notifications_read()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare n int;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  update notifications set read_at = now() where user_id = auth.uid() and read_at is null;
  get diagnostics n = row_count;
  return n;
end $function$;
revoke all on function public.mark_my_notifications_read() from public, anon;
grant execute on function public.mark_my_notifications_read() to authenticated;

-- 3. Live updates ---------------------------------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
      alter publication supabase_realtime add table public.notifications;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reschedule_requests') then
      alter publication supabase_realtime add table public.reschedule_requests;
    end if;
  end if;
end $$;
