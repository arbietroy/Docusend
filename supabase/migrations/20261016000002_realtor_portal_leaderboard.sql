-- ════════════════════════════════════════════════════════════════════════════
-- Realtor links and the realtor ranking. Safe to run more than once.
--
-- A realtor link is a private web address for one realtor: a read-only page of
-- their own clients' payment status and their commission. No login. Directors
-- create it, and can turn it off (or replace it) at any time.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.realtors add column if not exists portal_token text;
create unique index if not exists realtors_portal_token_idx on public.realtors (portal_token) where portal_token is not null;

-- Rebuild the realtor summary so it includes the new column
drop view if exists public.realtor_overview;
create view public.realtor_overview with (security_invoker = true) as
select r.*,
       count(distinct s.client_id) filter (where s.status in ('active', 'completed'))           as clients,
       count(s.id) filter (where s.status in ('active', 'completed'))                           as sales,
       coalesce(sum(s.units) filter (where s.status in ('active', 'completed')), 0)            as units_sold,
       coalesce(sum(s.total_price) filter (where s.status in ('active', 'completed')), 0)      as sales_value,
       coalesce(sum(pay.collected), 0)                                                         as collected,
       coalesce(sum(pay.collected * coalesce(s.commission_percent, r.commission_percent) / 100), 0) as commission_earned,
       coalesce((select sum(amount) from public.realtor_payouts p where p.realtor_id = r.id), 0) as commission_paid,
       max(s.start_date) filter (where s.status in ('active', 'completed'))                     as last_sale_on
from public.realtors r
left join public.subscriptions s on s.realtor_id = r.id
left join lateral (select sum(amount) as collected from public.payments x
                    where x.subscription_id = s.id and x.status = 'confirmed') pay on true
group by r.id;

-- Turn a realtor's link on (a new address each time) or off
create or replace function public.set_realtor_portal(p_realtor uuid, p_enabled boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_name text; v_token text;
begin
  select org_id, full_name into v_org, v_name from public.realtors where id = p_realtor;
  if v_org is null or not public.has_role(v_org, 'admin') then raise exception 'Only directors can manage realtor links'; end if;
  if p_enabled then
    -- two random UUIDs: 244 random bits, impossible to guess
    v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  end if;
  update public.realtors set portal_token = v_token where id = p_realtor;
  perform public.log_activity(v_org, 'realtor.portal', 'realtors', p_realtor,
    case when p_enabled then 'Created a private link for realtor ' else 'Turned off the private link for realtor ' end || v_name);
  return v_token;
end $$;

-- What a realtor sees through their link: only their own clients
create or replace function public.get_realtor_portal(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_r public.realtors; v jsonb;
begin
  if p_token is null or length(p_token) < 32 then return null; end if;
  select * into v_r from public.realtors where portal_token = p_token and is_active;
  if not found then return null; end if;
  select jsonb_build_object(
    'company', (select jsonb_build_object('name', o.name, 'logo_url', o.logo_url, 'brand_color', o.brand_color,
                                          'phone', o.phone, 'contact_email', o.contact_email, 'grace_days', o.grace_days)
                from public.organizations o where o.id = v_r.org_id),
    'realtor', jsonb_build_object('name', v_r.full_name, 'commission_percent', v_r.commission_percent),
    'commission', (select jsonb_build_object('earned', ro.commission_earned, 'paid', ro.commission_paid,
                                             'sales_value', ro.sales_value, 'collected', ro.collected)
                   from public.realtor_overview ro where ro.id = v_r.id),
    'clients', coalesce((
      select jsonb_agg(jsonb_build_object(
               'name', concat_ws(' ', s.client_title, s.client_name), 'client_number', s.client_number,
               'property', s.property_name, 'plan', s.plan_name, 'units', s.units, 'unit_type', s.unit_type,
               'total_price', s.total_price, 'paid', s.amount_paid, 'balance', s.balance,
               'overdue', s.amount_overdue, 'days_overdue', s.days_overdue,
               'next_due_date', s.next_due_date, 'next_due_amount', s.next_due_amount,
               'status', s.payment_status, 'last_paid_on', s.last_paid_on, 'start_date', s.start_date)
             order by case s.payment_status when 'defaulting' then 0 when 'owing' then 1 when 'on_track' then 2 else 3 end,
                      s.next_due_date nulls last)
      from public.subscription_overview s
      where s.realtor_id = v_r.id and s.status in ('active', 'completed')), '[]'::jsonb),
    'generated_at', now()
  ) into v;
  return v;
end $$;
grant execute on function public.get_realtor_portal(text) to anon, authenticated;

-- Which realtors bring in the most money in a period
create or replace function public.realtor_leaderboard(p_org uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  if not public.has_role(p_org, 'admin') then raise exception 'Directors only'; end if;
  select coalesce(jsonb_agg(row_to_json(t) order by t.collected desc, t.sales_value desc), '[]'::jsonb) into v
  from (
    select r.id, r.full_name as name, r.agency, r.commission_percent,
           coalesce(pay.collected, 0) as collected, coalesce(pay.commission, 0) as commission,
           coalesce(sal.sales, 0) as sales, coalesce(sal.sales_value, 0) as sales_value, coalesce(sal.units, 0) as units
    from public.realtors r
    left join lateral (
      select sum(x.amount) as collected,
             sum(x.amount * coalesce(s.commission_percent, r.commission_percent) / 100) as commission
      from public.payments x join public.subscriptions s on s.id = x.subscription_id
      where s.realtor_id = r.id and x.status = 'confirmed' and x.paid_on between p_from and p_to) pay on true
    left join lateral (
      select count(*) as sales, sum(s.total_price) as sales_value, sum(s.units) as units
      from public.subscriptions s
      where s.realtor_id = r.id and s.status in ('active', 'completed') and s.start_date between p_from and p_to) sal on true
    where r.org_id = p_org and (coalesce(pay.collected, 0) > 0 or coalesce(sal.sales, 0) > 0)
  ) t;
  return v;
end $$;
