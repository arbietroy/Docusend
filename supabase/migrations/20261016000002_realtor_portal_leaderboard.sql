-- ════════════════════════════════════════════════════════════════════════════
-- Realtor dashboard and the realtor ranking. Safe to run more than once.
--
-- Each company has a realtor login page (/realtor/<company>). A realtor signs up
-- with their email and the name clients know them by; the account is connected
-- to that company's realtor record with the same name (or the same email). One
-- account per realtor record; directors can see and disconnect it.
-- ════════════════════════════════════════════════════════════════════════════

-- An earlier draft used private links; they are replaced by realtor logins
drop function if exists public.set_realtor_portal(uuid, boolean);
drop function if exists public.get_realtor_portal(text);
drop index if exists public.realtors_portal_token_idx;
drop view if exists public.realtor_overview;
alter table public.realtors drop column if exists portal_token;
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

-- "Mr. Kunle  Ade" and "kunle ade" are the same realtor
create or replace function public.norm_person_name(p text) returns text
language sql immutable set search_path = '' as $$
  select btrim(regexp_replace(
           regexp_replace(lower(coalesce(p, '')), '^\s*(mr|mrs|miss|ms|dr|chief|engr|prof|pastor|alhaji|alhaja|barr)\.?\s+', ''),
           '[^a-z0-9]+', ' ', 'g'))
$$;

create table if not exists public.realtor_accounts (
  realtor_id  uuid primary key references public.realtors on delete cascade,
  org_id      uuid not null references public.organizations on delete cascade,
  user_id     uuid not null references auth.users on delete cascade,
  email       text not null,
  linked_by   text not null check (linked_by in ('email', 'name')),
  created_at  timestamptz not null default now()
);
create index if not exists realtor_accounts_user_idx on public.realtor_accounts (user_id);
alter table public.realtor_accounts enable row level security;
drop policy if exists realtor_accounts_select on public.realtor_accounts;
create policy realtor_accounts_select on public.realtor_accounts for select to authenticated using (public.has_role(org_id, 'admin'));
drop policy if exists realtor_accounts_delete on public.realtor_accounts;
create policy realtor_accounts_delete on public.realtor_accounts for delete to authenticated using (public.has_role(org_id, 'admin'));

-- A login a director disconnected can't reconnect itself to that realtor
create table if not exists public.realtor_account_blocks (
  realtor_id  uuid not null references public.realtors on delete cascade,
  user_id     uuid not null references auth.users on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (realtor_id, user_id)
);
alter table public.realtor_account_blocks enable row level security;

create or replace function public.on_realtor_account_removed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.realtor_account_blocks (realtor_id, user_id) values (old.realtor_id, old.user_id) on conflict do nothing;
  if exists (select 1 from public.realtors where id = old.realtor_id) then
    perform public.log_activity(old.org_id, 'realtor.account_disconnected', 'realtors', old.realtor_id,
      (select full_name from public.realtors where id = old.realtor_id) || '''s realtor login (' || old.email || ') was disconnected');
  end if;
  return old;
end $$;
drop trigger if exists realtor_account_removed on public.realtor_accounts;
create trigger realtor_account_removed after delete on public.realtor_accounts
  for each row execute function public.on_realtor_account_removed();

-- Public: the company name and logo for its realtor login page
create or replace function public.get_realtor_login_company(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name', name, 'logo_url', logo_url, 'brand_color', brand_color, 'slug', slug)
  from public.organizations where slug = lower(p_slug)
$$;
grant execute on function public.get_realtor_login_company(text) to anon, authenticated;

-- Connect the signed-in realtor to their record at a company
create or replace function public.claim_realtor(p_slug text, p_full_name text, p_phone text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_email text; v_confirmed timestamptz; v_org uuid; v_org_name text;
  v_id uuid; v_count int; v_name text := btrim(regexp_replace(coalesce(p_full_name, ''), '\s+', ' ', 'g'));
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''); v_how text;
begin
  select lower(email), email_confirmed_at into v_email, v_confirmed from auth.users where id = v_uid;
  if v_email is null then raise exception 'Please sign in first'; end if;
  if v_confirmed is null then raise exception 'Please confirm your email first'; end if;
  select id, name into v_org, v_org_name from public.organizations where slug = lower(p_slug);
  if v_org is null then raise exception 'Company not found. Check the link you were given.'; end if;

  -- Already connected here
  select realtor_id into v_id from public.realtor_accounts where user_id = v_uid and org_id = v_org;
  if v_id is not null then return jsonb_build_object('realtor_id', v_id, 'company', v_org_name); end if;

  -- Same email as a realtor the company already has
  select id into v_id from public.realtors r
   where r.org_id = v_org and lower(r.email) = v_email and r.is_active
     and not exists (select 1 from public.realtor_accounts a where a.realtor_id = r.id);
  v_how := 'email';

  if v_id is null then
    if length(public.norm_person_name(v_name)) < 3 then raise exception 'Please enter your full name as your clients know it'; end if;
    v_how := 'name';
    select count(*) into v_count from public.realtors r
     where r.org_id = v_org and r.is_active and public.norm_person_name(r.full_name) = public.norm_person_name(v_name);
    if v_count > 1 and v_phone is not null then
      select id into v_id from public.realtors r
       where r.org_id = v_org and r.is_active and public.norm_person_name(r.full_name) = public.norm_person_name(v_name)
         and right(regexp_replace(coalesce(r.phone, ''), '\D', '', 'g'), 10) = right(v_phone, 10);
    elsif v_count = 1 then
      select id into v_id from public.realtors r
       where r.org_id = v_org and r.is_active and public.norm_person_name(r.full_name) = public.norm_person_name(v_name);
    end if;
    if v_id is null and v_count > 1 then
      raise exception '% has more than one realtor named %. Please contact them to connect your account.', v_org_name, v_name;
    end if;
    if v_id is not null and exists (select 1 from public.realtor_accounts a where a.realtor_id = v_id) then
      raise exception 'Another account is already connected as % at %. If that isn''t you, please contact them.', v_name, v_org_name;
    end if;
    -- New to this company: add them so clients who name them later are linked
    if v_id is null then
      insert into public.realtors (org_id, full_name, email, phone) values (v_org, v_name, v_email, nullif(btrim(p_phone), ''))
      returning id into v_id;
    end if;
  end if;

  if exists (select 1 from public.realtor_account_blocks b where b.realtor_id = v_id and b.user_id = v_uid) then
    raise exception '% disconnected this login from %. Please contact them if this is a mistake.', v_org_name, (select full_name from public.realtors where id = v_id);
  end if;

  update public.realtors set email = coalesce(email, v_email), phone = coalesce(phone, nullif(btrim(p_phone), '')) where id = v_id;
  insert into public.realtor_accounts (realtor_id, org_id, user_id, email, linked_by) values (v_id, v_org, v_uid, v_email, v_how);
  perform public.log_activity(v_org, 'realtor.account_connected', 'realtors', v_id,
    (select full_name from public.realtors where id = v_id) || ' connected a realtor login (' || v_email || ', matched by ' || v_how || ')');
  return jsonb_build_object('realtor_id', v_id, 'company', v_org_name);
end $$;
revoke execute on function public.claim_realtor(text, text, text) from public, anon;
grant execute on function public.claim_realtor(text, text, text) to authenticated;

-- Everything a signed-in realtor sees: their clients at every connected company
create or replace function public.get_my_realtor_dashboard()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_email text; v_confirmed timestamptz; v jsonb;
begin
  select lower(email), email_confirmed_at into v_email, v_confirmed from auth.users where id = auth.uid();
  if v_email is null then raise exception 'Not signed in'; end if;
  if v_confirmed is null then
    return jsonb_build_object('email', v_email, 'confirmed', false, 'companies', '[]'::jsonb);
  end if;
  select jsonb_build_object('email', v_email, 'confirmed', true, 'companies', coalesce(jsonb_agg(c order by c->>'company_name'), '[]'::jsonb))
    into v
  from (
    select jsonb_build_object(
      'realtor_id', r.id, 'realtor_name', r.full_name, 'commission_percent', r.commission_percent,
      'company_name', o.name, 'slug', o.slug, 'logo_url', o.logo_url, 'brand_color', o.brand_color,
      'phone', o.phone, 'contact_email', o.contact_email,
      'commission', (select jsonb_build_object('earned', ro.commission_earned, 'paid', ro.commission_paid,
                                               'sales_value', ro.sales_value, 'collected', ro.collected)
                     from public.realtor_overview ro where ro.id = r.id),
      -- Only what a realtor needs to follow up: no client phone numbers or emails
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
        where s.realtor_id = r.id and s.status in ('active', 'completed')), '[]'::jsonb)
    ) as c
    from public.realtors r join public.organizations o on o.id = r.org_id
    where r.is_active and r.id in (select realtor_id from public.realtor_accounts where user_id = auth.uid())
  ) t;
  return v;
end $$;
revoke execute on function public.get_my_realtor_dashboard() from public, anon;
grant execute on function public.get_my_realtor_dashboard() to authenticated;

-- When a client names a realtor on a form, match names the same forgiving way
create or replace function public.find_or_create_realtor(p_org uuid, p_name text, p_email text, p_phone text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_email text := nullif(lower(trim(p_email)), ''); v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
        v_name text := nullif(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), '');
begin
  if v_email is not null then
    select id into v_id from public.realtors where org_id = p_org and lower(email) = v_email;
  end if;
  if v_id is null and length(v_phone) >= 7 then
    select id into v_id from public.realtors
     where org_id = p_org and right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10) = right(v_phone, 10) limit 1;
  end if;
  if v_id is null and v_name is not null then
    select id into v_id from public.realtors
     where org_id = p_org and public.norm_person_name(full_name) = public.norm_person_name(v_name)
     order by created_at limit 1;
  end if;
  if v_id is null and coalesce(v_name, v_email) is not null then
    insert into public.realtors (org_id, full_name, email, phone)
    values (p_org, coalesce(v_name, split_part(v_email, '@', 1)), v_email, nullif(trim(p_phone), ''))
    returning id into v_id;
  end if;
  return v_id;
end $$;
revoke execute on function public.find_or_create_realtor(uuid, text, text, text) from public, anon, authenticated;

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
