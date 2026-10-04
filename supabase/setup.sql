-- DocuSend database setup: paste this whole file into Supabase → SQL Editor → Run.
-- Generated from supabase/migrations by scripts/bundle-sql.sh. Don't edit by hand.

-- ═══ 20261004000001_foundation.sql ═══
-- ════════════════════════════════════════════════════════════════════════════
-- DocuSend — Phase 1 foundation
--
-- Multi-company (multi-tenant) schema. Every business table carries org_id and
-- is protected by row level security, so a company can only ever see its own
-- data. Writes that need extra rules (confirming payments, numbering clients,
-- public form submissions) go through SECURITY DEFINER functions that check
-- the caller's role themselves.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Roles ──────────────────────────────────────────────────────────────────
-- Declared lowest → highest so `role >= 'team_lead'` means "team lead or above".
create type public.member_role as enum ('team_member', 'team_lead', 'admin', 'super_admin');

-- ─── Companies ──────────────────────────────────────────────────────────────
create table public.organizations (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(trim(name)) between 2 and 120),
  slug            text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'),
  client_prefix   text not null check (client_prefix ~ '^[A-Z0-9]{2,6}$'),
  logo_url        text,
  brand_color     text not null default '#2563EB' check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  contact_email   text,
  phone           text,
  address         text,
  sender_name     text,
  sender_email    text,
  bank_name       text,
  account_name    text,
  account_number  text,
  grace_days      int  not null default 30 check (grace_days between 0 and 365),
  plan            text not null default 'growth' check (plan in ('starter', 'growth', 'enterprise')),
  trial_ends_at   timestamptz not null default (now() + interval '7 days'),
  client_seq      int  not null default 0,
  receipt_seq     int  not null default 0,
  is_demo         boolean not null default false,
  created_by      uuid references auth.users on delete set null,
  created_at      timestamptz not null default now()
);

create table public.members (
  org_id      uuid not null references public.organizations on delete cascade,
  user_id     uuid not null references auth.users on delete cascade,
  role        public.member_role not null default 'team_member',
  full_name   text,
  email       text,
  created_at  timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index members_user_idx on public.members (user_id);

create table public.invitations (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations on delete cascade,
  email        text not null check (email = lower(trim(email)) and email like '%@%'),
  role         public.member_role not null default 'team_member',
  invited_by   uuid references auth.users on delete set null,
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  unique (org_id, email)
);

-- ─── Properties ─────────────────────────────────────────────────────────────
create table public.properties (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations on delete cascade,
  name            text not null check (length(trim(name)) between 2 and 120),
  code            text not null check (code ~ '^[A-Z0-9]{1,6}$'),
  location        text,
  description     text,
  unit_type       text not null default 'plot'
                  check (unit_type in ('plot', 'acre', 'hectare', 'sqm', 'apartment', 'house', 'unit')),
  unit_size_sqm   numeric(12,2) check (unit_size_sqm > 0),
  total_units     numeric(12,2) not null default 0 check (total_units >= 0),
  status          text not null default 'active' check (status in ('pre_launch', 'active', 'sold_out', 'archived')),
  bank_name       text,
  account_name    text,
  account_number  text,
  created_by      uuid references auth.users on delete set null,
  created_at      timestamptz not null default now(),
  unique (org_id, code),
  unique (org_id, id)
);

-- Price per unit differs by plan: outright is usually cheaper than instalments.
create table public.payment_plans (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null,
  property_id          uuid not null,
  name                 text not null check (length(trim(name)) between 1 and 60),
  duration_months      int  not null default 0 check (duration_months between 0 and 120),
  price_per_unit       numeric(14,2) not null check (price_per_unit > 0),
  min_deposit_percent  numeric(5,2) not null default 0 check (min_deposit_percent between 0 and 100),
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  foreign key (org_id, property_id) references public.properties (org_id, id) on delete cascade,
  unique (org_id, id)
);

-- ─── Clients ────────────────────────────────────────────────────────────────
create table public.clients (
  id                        uuid primary key default gen_random_uuid(),
  org_id                    uuid not null references public.organizations on delete cascade,
  -- Company-wide client number (the "300" in LAP-NA-300). Given out when the
  -- client's first payment is confirmed, so spam form entries don't use numbers.
  client_seq                int,
  full_name                 text not null check (length(trim(full_name)) between 2 and 160),
  email                     text,
  phone                     text,
  address                   text,
  occupation                text,
  date_of_birth             date,
  id_type                   text,
  id_number                 text,
  next_of_kin_name          text,
  next_of_kin_phone         text,
  next_of_kin_relationship  text,
  source                    text not null default 'manual' check (source in ('form', 'manual', 'import')),
  notes                     text,
  created_by                uuid references auth.users on delete set null,
  created_at                timestamptz not null default now(),
  unique (org_id, client_seq),
  unique (org_id, id)
);
create index clients_org_name_idx on public.clients (org_id, lower(full_name));

-- A client's purchase of units in one property, on one payment plan.
create table public.subscriptions (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null,
  client_id        uuid not null,
  property_id      uuid not null,
  payment_plan_id  uuid,
  client_number    text,             -- e.g. LAP-NA-300, set when activated
  units            numeric(12,2) not null default 1 check (units > 0),
  -- Plan terms are copied in so later price changes don't affect this client.
  plan_name            text not null,
  duration_months      int  not null default 0 check (duration_months >= 0),
  unit_price           numeric(14,2) not null check (unit_price > 0),
  min_deposit_percent  numeric(5,2) not null default 0,
  discount_amount      numeric(14,2) not null default 0 check (discount_amount >= 0),
  discount_reason      text,
  total_price          numeric(14,2) generated always as (round(units * unit_price, 2) - discount_amount) stored,
  start_date       date not null default current_date,
  plot_numbers     text,
  status           text not null default 'pending' check (status in ('pending', 'active', 'completed', 'cancelled')),
  realtor_name     text,
  realtor_email    text,
  realtor_phone    text,
  created_by       uuid references auth.users on delete set null,
  created_at       timestamptz not null default now(),
  foreign key (org_id, client_id)   references public.clients (org_id, id) on delete cascade,
  foreign key (org_id, property_id) references public.properties (org_id, id) on delete restrict,
  foreign key (org_id, payment_plan_id) references public.payment_plans (org_id, id) on delete set null (payment_plan_id),
  check (discount_amount <= round(units * unit_price, 2)),
  unique (org_id, client_number),
  unique (org_id, id)
);
create index subscriptions_client_idx   on public.subscriptions (client_id);
create index subscriptions_property_idx on public.subscriptions (property_id);

create table public.payments (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null,
  subscription_id   uuid not null,
  amount            numeric(14,2) not null check (amount > 0),
  paid_on           date not null default current_date,
  method            text not null default 'bank_transfer' check (method in ('bank_transfer', 'cash', 'cheque', 'pos', 'other')),
  payer_name        text,
  bank_reference    text,
  proof_path        text,
  notes             text,
  status            text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  source            text not null default 'manual' check (source in ('form', 'manual', 'import')),
  receipt_number    text,
  submitted_by      uuid references auth.users on delete set null,
  submitted_at      timestamptz not null default now(),
  reviewed_by       uuid references auth.users on delete set null,
  reviewed_at       timestamptz,
  rejection_reason  text,
  foreign key (org_id, subscription_id) references public.subscriptions (org_id, id) on delete cascade,
  unique (org_id, receipt_number)
);
create index payments_subscription_idx on public.payments (subscription_id);
create index payments_org_status_idx   on public.payments (org_id, status, submitted_at desc);

-- ─── Activity log ───────────────────────────────────────────────────────────
create table public.activity_log (
  id           bigint generated always as identity primary key,
  org_id       uuid not null references public.organizations on delete cascade,
  actor_id     uuid,
  actor_name   text not null,
  action       text not null,
  entity_type  text not null,
  entity_id    uuid,
  summary      text not null,
  created_at   timestamptz not null default now()
);
create index activity_log_org_idx on public.activity_log (org_id, created_at desc);

-- ════════════════════════════════════════════════════════════════════════════
-- Helper functions
-- ════════════════════════════════════════════════════════════════════════════

create function public.my_role(p_org uuid) returns public.member_role
language sql stable security definer set search_path = '' as $$
  select role from public.members where org_id = p_org and user_id = (select auth.uid())
$$;

create function public.has_role(p_org uuid, p_min public.member_role) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.my_role(p_org) >= p_min, false)
$$;

create function public.is_member(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.my_role(p_org) is not null
$$;

create function public.format_naira(p numeric) returns text
language sql immutable set search_path = '' as $$
  select '₦' || to_char(p, 'FM999,999,999,999,990.00')
$$;

create function public.format_client_number(p_prefix text, p_code text, p_seq int) returns text
language sql immutable set search_path = '' as $$
  select p_prefix || '-' || p_code || '-' || lpad(p_seq::text, 3, '0')
$$;

create function public.actor_name(p_org uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select coalesce(nullif(full_name, ''), email) from public.members
      where org_id = p_org and user_id = (select auth.uid())),
    case when (select auth.uid()) is null then 'Client (online form)' else 'System' end)
$$;

create function public.log_activity(p_org uuid, p_action text, p_entity_type text, p_entity_id uuid, p_summary text)
returns void language sql security definer set search_path = '' as $$
  insert into public.activity_log (org_id, actor_id, actor_name, action, entity_type, entity_id, summary)
  values (p_org, (select auth.uid()), public.actor_name(p_org), p_action, p_entity_type, p_entity_id, p_summary)
$$;
revoke execute on function public.log_activity(uuid, text, text, uuid, text) from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- Row level security
-- ════════════════════════════════════════════════════════════════════════════
alter table public.organizations enable row level security;
alter table public.members       enable row level security;
alter table public.invitations   enable row level security;
alter table public.properties    enable row level security;
alter table public.payment_plans enable row level security;
alter table public.clients       enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments      enable row level security;
alter table public.activity_log  enable row level security;

-- Companies: members read; admins edit (numbering counters are protected below)
create policy org_select on public.organizations for select to authenticated using (public.is_member(id));
create policy org_update on public.organizations for update to authenticated
  using (public.has_role(id, 'admin')) with check (public.has_role(id, 'admin'));

-- Team: everyone sees the team; changes go through functions
create policy members_select on public.members for select to authenticated using (public.is_member(org_id));

create policy invitations_select on public.invitations for select to authenticated using (public.has_role(org_id, 'admin'));
create policy invitations_insert on public.invitations for insert to authenticated
  with check (public.has_role(org_id, 'admin') and (role < 'super_admin' or public.has_role(org_id, 'super_admin')));
create policy invitations_delete on public.invitations for delete to authenticated using (public.has_role(org_id, 'admin'));

-- Properties and plans: everyone reads; admins manage
create policy properties_select on public.properties for select to authenticated using (public.is_member(org_id));
create policy properties_write  on public.properties for all to authenticated
  using (public.has_role(org_id, 'admin')) with check (public.has_role(org_id, 'admin'));
create policy plans_select on public.payment_plans for select to authenticated using (public.is_member(org_id));
create policy plans_write  on public.payment_plans for all to authenticated
  using (public.has_role(org_id, 'admin')) with check (public.has_role(org_id, 'admin'));

-- Clients: the whole team works the client list; only admins delete
create policy clients_select on public.clients for select to authenticated using (public.is_member(org_id));
create policy clients_insert on public.clients for insert to authenticated with check (public.is_member(org_id));
create policy clients_update on public.clients for update to authenticated
  using (public.is_member(org_id)) with check (public.is_member(org_id));
create policy clients_delete on public.clients for delete to authenticated using (public.has_role(org_id, 'admin'));

-- Subscriptions: anyone can record one; changing price/discount needs a team lead
create policy subs_select on public.subscriptions for select to authenticated using (public.is_member(org_id));
create policy subs_insert on public.subscriptions for insert to authenticated with check (public.is_member(org_id));
create policy subs_update on public.subscriptions for update to authenticated
  using (public.has_role(org_id, 'team_lead')) with check (public.has_role(org_id, 'team_lead'));
create policy subs_delete on public.subscriptions for delete to authenticated using (public.has_role(org_id, 'admin'));

-- Payments: anyone can record a pending payment; confirming goes through
-- confirm_payment()/reject_payment(); only admins delete
create policy payments_select on public.payments for select to authenticated using (public.is_member(org_id));
create policy payments_insert on public.payments for insert to authenticated
  with check (public.is_member(org_id) and status = 'pending' and receipt_number is null and reviewed_by is null);
create policy payments_delete on public.payments for delete to authenticated using (public.has_role(org_id, 'admin'));

create policy activity_select on public.activity_log for select to authenticated using (public.has_role(org_id, 'admin'));

-- Members can't change numbering counters, the plan or the trial by editing the row
create function public.protect_org_columns() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_setting('docusend.internal', true) = 'on' then return new; end if;
  if new.client_seq <> old.client_seq or new.receipt_seq <> old.receipt_seq
     or new.trial_ends_at <> old.trial_ends_at or new.plan <> old.plan
     or new.is_demo <> old.is_demo or new.slug <> old.slug or new.created_by is distinct from old.created_by then
    raise exception 'These company settings can''t be changed directly';
  end if;
  return new;
end $$;
create trigger organizations_protect before update on public.organizations
  for each row execute function public.protect_org_columns();

-- Client numbers are assigned by the system only
create function public.protect_client_seq() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_setting('docusend.internal', true) = 'on' then return new; end if;
  if tg_op = 'INSERT' and new.client_seq is not null then
    raise exception 'Client numbers are assigned automatically';
  elsif tg_op = 'UPDATE' and new.client_seq is distinct from old.client_seq then
    raise exception 'Client numbers can''t be changed';
  end if;
  return new;
end $$;
create trigger clients_protect before insert or update on public.clients
  for each row execute function public.protect_client_seq();

create function public.protect_subscription_columns() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_setting('docusend.internal', true) = 'on' then return new; end if;
  if tg_op = 'INSERT' and (new.client_number is not null or new.status <> 'pending') then
    raise exception 'New purchases start as pending';
  elsif tg_op = 'UPDATE' and new.client_number is distinct from old.client_number then
    raise exception 'Client numbers can''t be changed';
  end if;
  return new;
end $$;
create trigger subscriptions_protect before insert or update on public.subscriptions
  for each row execute function public.protect_subscription_columns();

-- ════════════════════════════════════════════════════════════════════════════
-- Balances, schedules and arrears
-- ════════════════════════════════════════════════════════════════════════════
-- Instalment model: the deposit is due on the start date, and the rest is split
-- evenly over the plan's months, due on the same day each month.
create view public.subscription_overview with (security_invoker = true) as
with paid as (
  select subscription_id,
         sum(amount) filter (where status = 'confirmed') as paid,
         sum(amount) filter (where status = 'pending')   as pending,
         max(paid_on) filter (where status = 'confirmed') as last_paid_on
  from public.payments group by subscription_id
), base as (
  select s.*,
         c.full_name as client_name, c.email as client_email, c.phone as client_phone, c.client_seq,
         p.name as property_name, p.code as property_code, p.unit_type,
         coalesce(pd.paid, 0)    as amount_paid,
         coalesce(pd.pending, 0) as amount_pending,
         pd.last_paid_on,
         round(s.total_price * s.min_deposit_percent / 100, 2) as deposit,
         o.grace_days
  from public.subscriptions s
  join public.clients c        on c.id = s.client_id
  join public.properties p     on p.id = s.property_id
  join public.organizations o  on o.id = s.org_id
  left join paid pd            on pd.subscription_id = s.id
), sched as (
  select b.*,
         -- the first instalment that isn't fully covered by what's been paid
         (select min(b.start_date + make_interval(months => i))::date
            from generate_series(0, b.duration_months) i
           where (case when b.duration_months = 0 then b.total_price
                       else b.deposit + (b.total_price - b.deposit) * i / b.duration_months end) > b.amount_paid
         ) as first_unpaid_due,
         (case when b.duration_months = 0 then
                 case when current_date >= b.start_date then b.total_price else 0 end
               else b.deposit + (b.total_price - b.deposit)
                    * least(b.duration_months,
                            (extract(year from age(current_date, b.start_date)) * 12
                             + extract(month from age(current_date, b.start_date)))::int)
                    / b.duration_months
          end) as expected_to_date
  from base b
)
select sched.*,
       greatest(total_price - amount_paid, 0)                       as balance,
       greatest(round(expected_to_date, 2) - amount_paid, 0)        as amount_overdue,
       case when amount_paid < total_price and first_unpaid_due is not null
                 and first_unpaid_due <= current_date
            then current_date - first_unpaid_due else 0 end          as days_overdue,
       case when amount_paid < total_price then first_unpaid_due end as next_due_date,
       case
         when status = 'cancelled'                                   then 'cancelled'
         when status = 'pending'                                     then 'pending'
         when amount_paid >= total_price                             then 'fully_paid'
         when round(expected_to_date, 2) > amount_paid
              and current_date - first_unpaid_due > grace_days       then 'defaulting'
         when round(expected_to_date, 2) > amount_paid               then 'owing'
         else 'on_track'
       end as payment_status
from sched;

-- ════════════════════════════════════════════════════════════════════════════
-- Company setup and team
-- ════════════════════════════════════════════════════════════════════════════
create function public.create_organization(p_name text, p_slug text, p_prefix text, p_full_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  insert into public.organizations (name, slug, client_prefix, created_by)
  values (trim(p_name), lower(trim(p_slug)), upper(trim(p_prefix)), v_uid)
  returning id into v_org;
  insert into public.members (org_id, user_id, role, full_name, email)
  values (v_org, v_uid, 'super_admin', nullif(trim(p_full_name), ''), (select email from auth.users where id = v_uid));
  perform public.log_activity(v_org, 'company.created', 'organization', v_org, 'Created the company workspace');
  return v_org;
exception when unique_violation then
  raise exception 'That web address is already taken. Try another.';
end $$;

-- Invitations addressed to the signed-in user's email
create function public.my_invitations()
returns table (id uuid, org_id uuid, org_name text, role public.member_role)
language sql stable security definer set search_path = '' as $$
  select i.id, i.org_id, o.name, i.role
  from public.invitations i join public.organizations o on o.id = i.org_id
  where i.accepted_at is null
    and i.email = lower((select email from auth.users where id = (select auth.uid())))
$$;

create function public.accept_invitation(p_invitation uuid, p_full_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_inv public.invitations; v_email text;
begin
  select lower(email) into v_email from auth.users where id = auth.uid();
  select * into v_inv from public.invitations
   where id = p_invitation and accepted_at is null and email = v_email;
  if not found then raise exception 'Invitation not found'; end if;
  insert into public.members (org_id, user_id, role, full_name, email)
  values (v_inv.org_id, auth.uid(), v_inv.role, nullif(trim(p_full_name), ''), v_email)
  on conflict (org_id, user_id) do nothing;
  update public.invitations set accepted_at = now() where id = v_inv.id;
  perform public.log_activity(v_inv.org_id, 'team.joined', 'member', auth.uid(),
    'Joined the team as ' || replace(v_inv.role::text, '_', ' '));
  return v_inv.org_id;
end $$;

create function public.update_member_role(p_org uuid, p_user uuid, p_role public.member_role)
returns void language plpgsql security definer set search_path = '' as $$
declare v_current public.member_role; v_name text;
begin
  if not public.has_role(p_org, 'admin') then raise exception 'Only admins can change roles'; end if;
  select role, coalesce(full_name, email) into v_current, v_name from public.members where org_id = p_org and user_id = p_user;
  if not found then raise exception 'Team member not found'; end if;
  if (v_current = 'super_admin' or p_role = 'super_admin') and not public.has_role(p_org, 'super_admin') then
    raise exception 'Only a super admin can change super admin access';
  end if;
  if v_current = 'super_admin' and p_role <> 'super_admin'
     and (select count(*) from public.members where org_id = p_org and role = 'super_admin') = 1 then
    raise exception 'The company needs at least one super admin';
  end if;
  update public.members set role = p_role where org_id = p_org and user_id = p_user;
  perform public.log_activity(p_org, 'team.role_changed', 'member', p_user,
    'Changed ' || v_name || '''s role to ' || replace(p_role::text, '_', ' '));
end $$;

create function public.remove_member(p_org uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_role public.member_role; v_name text;
begin
  if not public.has_role(p_org, 'admin') and p_user <> auth.uid() then
    raise exception 'Only admins can remove team members';
  end if;
  select role, coalesce(full_name, email) into v_role, v_name from public.members where org_id = p_org and user_id = p_user;
  if not found then raise exception 'Team member not found'; end if;
  if v_role = 'super_admin' and p_user <> auth.uid() and not public.has_role(p_org, 'super_admin') then
    raise exception 'Only a super admin can remove a super admin';
  end if;
  if v_role = 'super_admin'
     and (select count(*) from public.members where org_id = p_org and role = 'super_admin') = 1 then
    raise exception 'The company needs at least one super admin';
  end if;
  delete from public.members where org_id = p_org and user_id = p_user;
  perform public.log_activity(p_org, 'team.removed', 'member', p_user, 'Removed ' || v_name || ' from the team');
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- Payments
-- ════════════════════════════════════════════════════════════════════════════
create function public.confirm_payment(p_payment uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_pay public.payments; v_sub public.subscriptions; v_org public.organizations;
  v_client public.clients; v_code text; v_receipt text; v_paid numeric;
begin
  select * into v_pay from public.payments where id = p_payment for update;
  if not found then raise exception 'Payment not found'; end if;
  if not public.has_role(v_pay.org_id, 'team_lead') then raise exception 'Only team leads and above can confirm payments'; end if;
  if v_pay.status <> 'pending' then raise exception 'This payment has already been %', v_pay.status; end if;

  perform set_config('docusend.internal', 'on', true);
  select * into v_sub from public.subscriptions where id = v_pay.subscription_id for update;
  select * into v_client from public.clients where id = v_sub.client_id for update;
  select code into v_code from public.properties where id = v_sub.property_id;

  update public.organizations set receipt_seq = receipt_seq + 1
   where id = v_pay.org_id returning * into v_org;
  v_receipt := v_org.client_prefix || '-RCT-' || lpad(v_org.receipt_seq::text, 5, '0');

  -- First confirmed payment: give the client their company-wide number
  if v_client.client_seq is null then
    update public.organizations set client_seq = client_seq + 1
     where id = v_pay.org_id returning * into v_org;
    update public.clients set client_seq = v_org.client_seq where id = v_client.id returning * into v_client;
  end if;

  update public.payments
     set status = 'confirmed', receipt_number = v_receipt, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_payment;

  select coalesce(sum(amount), 0) into v_paid from public.payments
   where subscription_id = v_sub.id and status = 'confirmed';

  update public.subscriptions
     set client_number = coalesce(client_number, public.format_client_number(v_org.client_prefix, v_code, v_client.client_seq)
                           || case when exists (select 1 from public.subscriptions x
                                                 where x.org_id = v_sub.org_id and x.id <> v_sub.id
                                                   and x.client_number = public.format_client_number(v_org.client_prefix, v_code, v_client.client_seq))
                                   then '-' || (select count(*) + 1 from public.subscriptions x
                                                 where x.client_id = v_sub.client_id and x.property_id = v_sub.property_id
                                                   and x.client_number is not null)::text
                                   else '' end),
         status = case when v_paid >= v_sub.total_price then 'completed'
                       when status = 'pending' then 'active' else status end
   where id = v_sub.id;

  perform public.log_activity(v_pay.org_id, 'payment.confirmed', 'payment', p_payment,
    'Confirmed ' || public.format_naira(v_pay.amount) || ' from ' || v_client.full_name || ' (receipt ' || v_receipt || ')');
  return v_receipt;
end $$;

create function public.reject_payment(p_payment uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_pay public.payments; v_name text;
begin
  select * into v_pay from public.payments where id = p_payment for update;
  if not found then raise exception 'Payment not found'; end if;
  if not public.has_role(v_pay.org_id, 'team_lead') then raise exception 'Only team leads and above can reject payments'; end if;
  if v_pay.status <> 'pending' then raise exception 'This payment has already been %', v_pay.status; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Please give a reason'; end if;
  update public.payments
     set status = 'rejected', rejection_reason = trim(p_reason), reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_payment;
  select c.full_name into v_name from public.subscriptions s join public.clients c on c.id = s.client_id
   where s.id = v_pay.subscription_id;
  perform public.log_activity(v_pay.org_id, 'payment.rejected', 'payment', p_payment,
    'Rejected ' || public.format_naira(v_pay.amount) || ' from ' || v_name || ': ' || trim(p_reason));
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- Public client forms (no login)
-- ════════════════════════════════════════════════════════════════════════════
create function public.get_public_form(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'org_id', o.id, 'name', o.name, 'logo_url', o.logo_url, 'brand_color', o.brand_color,
    'contact_email', o.contact_email, 'phone', o.phone,
    'bank_name', o.bank_name, 'account_name', o.account_name, 'account_number', o.account_number,
    'properties', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'location', p.location, 'unit_type', p.unit_type,
        'unit_size_sqm', p.unit_size_sqm,
        'bank_name', p.bank_name, 'account_name', p.account_name, 'account_number', p.account_number,
        'plans', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', pl.id, 'name', pl.name, 'duration_months', pl.duration_months,
            'price_per_unit', pl.price_per_unit, 'min_deposit_percent', pl.min_deposit_percent)
            order by pl.duration_months)
          from public.payment_plans pl where pl.property_id = p.id and pl.is_active), '[]'::jsonb))
        order by p.name)
      from public.properties p where p.org_id = o.id and p.status in ('pre_launch', 'active')), '[]'::jsonb))
  from public.organizations o where o.slug = lower(p_slug)
$$;

create function public.submit_subscription_form(p_slug text, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid; v_plan public.payment_plans; v_client uuid; v_sub uuid; v_units numeric; v_amount numeric;
  v_name text := trim(p->>'full_name');
begin
  select id into v_org from public.organizations where slug = lower(p_slug);
  if v_org is null then raise exception 'Form not found'; end if;
  select pl.* into v_plan from public.payment_plans pl
    join public.properties pr on pr.id = pl.property_id
   where pl.id = (p->>'payment_plan_id')::uuid and pl.org_id = v_org and pl.is_active
     and pr.id = (p->>'property_id')::uuid and pr.status in ('pre_launch', 'active');
  if not found then raise exception 'Please choose a property and payment plan'; end if;
  v_units  := coalesce((p->>'units')::numeric, 1);
  v_amount := (p->>'amount')::numeric;
  if v_units <= 0 or v_units > 10000 then raise exception 'Please enter a valid number of units'; end if;
  if v_amount is null or v_amount <= 0 then raise exception 'Please enter the amount you paid'; end if;
  if coalesce(length(v_name), 0) < 2 then raise exception 'Please enter your full name'; end if;
  if coalesce(p->>'email', '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Please enter a valid email'; end if;

  perform set_config('docusend.internal', 'off', true);
  insert into public.clients (org_id, full_name, email, phone, address, occupation, date_of_birth,
                              id_type, id_number, next_of_kin_name, next_of_kin_phone, next_of_kin_relationship, source)
  values (v_org, v_name, lower(trim(p->>'email')), p->>'phone', p->>'address', p->>'occupation',
          nullif(p->>'date_of_birth', '')::date, p->>'id_type', p->>'id_number',
          p->>'next_of_kin_name', p->>'next_of_kin_phone', p->>'next_of_kin_relationship', 'form')
  returning id into v_client;

  insert into public.subscriptions (org_id, client_id, property_id, payment_plan_id, units,
                                    plan_name, duration_months, unit_price, min_deposit_percent,
                                    start_date, realtor_name, realtor_email, realtor_phone)
  values (v_org, v_client, v_plan.property_id, v_plan.id, v_units,
          v_plan.name, v_plan.duration_months, v_plan.price_per_unit, v_plan.min_deposit_percent,
          coalesce(nullif(p->>'paid_on', '')::date, current_date),
          nullif(trim(p->>'realtor_name'), ''), nullif(lower(trim(p->>'realtor_email')), ''), nullif(trim(p->>'realtor_phone'), ''))
  returning id into v_sub;

  insert into public.payments (org_id, subscription_id, amount, paid_on, payer_name, bank_reference, proof_path, source, notes)
  values (v_org, v_sub, v_amount, coalesce(nullif(p->>'paid_on', '')::date, current_date),
          coalesce(nullif(trim(p->>'payer_name'), ''), v_name), p->>'bank_reference',
          case when p->>'proof_path' like v_org::text || '/%' then p->>'proof_path' end, 'form', p->>'notes');

  perform public.log_activity(v_org, 'form.subscription', 'client', v_client,
    v_name || ' submitted a subscription form with a ' || public.format_naira(v_amount) || ' payment');
  return jsonb_build_object('ok', true);
end $$;

-- Instalments: the client identifies themselves with their client number plus
-- the email or phone on file.
create function public.submit_payment_form(p_slug text, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_sub record; v_amount numeric := (p->>'amount')::numeric; v_contact text := lower(trim(p->>'contact'));
begin
  select id into v_org from public.organizations where slug = lower(p_slug);
  if v_org is null then raise exception 'Form not found'; end if;
  if v_amount is null or v_amount <= 0 then raise exception 'Please enter the amount you paid'; end if;
  select s.id, c.full_name, c.id as client_id into v_sub
    from public.subscriptions s join public.clients c on c.id = s.client_id
   where s.org_id = v_org and upper(s.client_number) = upper(trim(p->>'client_number'))
     and s.status in ('active', 'completed')
     and (lower(c.email) = v_contact
          or (length(regexp_replace(v_contact, '\D', '', 'g')) >= 7
              and right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 10)
                = right(regexp_replace(v_contact, '\D', '', 'g'), 10)));
  if not found then
    raise exception 'We couldn''t find that client number with that email or phone. Please check and try again.';
  end if;
  insert into public.payments (org_id, subscription_id, amount, paid_on, payer_name, bank_reference, proof_path, source, notes)
  values (v_org, v_sub.id, v_amount, coalesce(nullif(p->>'paid_on', '')::date, current_date),
          coalesce(nullif(trim(p->>'payer_name'), ''), v_sub.full_name), p->>'bank_reference',
          case when p->>'proof_path' like v_org::text || '/%' then p->>'proof_path' end, 'form', p->>'notes');
  perform public.log_activity(v_org, 'form.payment', 'client', v_sub.client_id,
    v_sub.full_name || ' submitted a ' || public.format_naira(v_amount) || ' instalment payment');
  return jsonb_build_object('ok', true, 'client_name', v_sub.full_name);
end $$;

grant execute on function public.get_public_form(text)                 to anon, authenticated;
grant execute on function public.submit_subscription_form(text, jsonb) to anon, authenticated;
grant execute on function public.submit_payment_form(text, jsonb)      to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- Activity logging for direct edits
-- ════════════════════════════════════════════════════════════════════════════
create function public.log_table_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_row record; v_summary text; v_name text; v_org uuid;
begin
  if tg_op = 'DELETE' then v_row := old; else v_row := new; end if;
  -- Changes made inside the functions above are logged there with better wording
  if current_setting('docusend.internal', true) = 'on' or auth.uid() is null then return null; end if;
  case tg_table_name
    when 'properties' then
      v_summary := case tg_op when 'INSERT' then 'Added property ' when 'UPDATE' then 'Updated property ' else 'Deleted property ' end || v_row.name;
    when 'payment_plans' then
      select name into v_name from public.properties where id = v_row.property_id;
      v_summary := case tg_op when 'INSERT' then 'Added' when 'UPDATE' then 'Updated' else 'Deleted' end
                   || ' the "' || v_row.name || '" plan on ' || coalesce(v_name, 'a property');
    when 'clients' then
      v_summary := case tg_op when 'INSERT' then 'Added client ' when 'UPDATE' then 'Updated client ' else 'Deleted client ' end || v_row.full_name;
    when 'subscriptions' then
      select full_name into v_name from public.clients where id = v_row.client_id;
      v_summary := case tg_op when 'INSERT' then 'Recorded a purchase for ' when 'UPDATE' then 'Updated the purchase for ' else 'Deleted a purchase for ' end
                   || coalesce(v_name, 'a client');
      if tg_op = 'UPDATE' and new.discount_amount <> old.discount_amount then
        v_summary := v_summary || ' (discount ' || public.format_naira(new.discount_amount)
                     || coalesce(': ' || new.discount_reason, '') || ')';
      end if;
    when 'payments' then
      select c.full_name into v_name from public.subscriptions s join public.clients c on c.id = s.client_id where s.id = v_row.subscription_id;
      v_summary := case tg_op when 'INSERT' then 'Recorded a ' when 'UPDATE' then 'Updated a ' else 'Deleted a ' end
                   || public.format_naira(v_row.amount) || ' payment for ' || coalesce(v_name, 'a client');
    when 'invitations' then
      v_summary := case tg_op when 'INSERT' then 'Invited ' || v_row.email || ' as ' || replace(v_row.role::text, '_', ' ')
                              else 'Cancelled the invitation for ' || v_row.email end;
    when 'organizations' then
      v_summary := 'Updated company settings';
    else v_summary := tg_op || ' on ' || tg_table_name;
  end case;
  -- (plpgsql resolves record fields eagerly, so read org_id only where it exists)
  if tg_table_name = 'organizations' then v_org := v_row.id; else v_org := v_row.org_id; end if;
  perform public.log_activity(v_org, tg_table_name || '.' || lower(tg_op), tg_table_name, v_row.id, v_summary);
  return null;
end $$;

create trigger log_properties    after insert or update or delete on public.properties    for each row execute function public.log_table_change();
create trigger log_payment_plans after insert or update or delete on public.payment_plans for each row execute function public.log_table_change();
create trigger log_clients       after insert or update or delete on public.clients       for each row execute function public.log_table_change();
create trigger log_subscriptions after insert or update or delete on public.subscriptions for each row execute function public.log_table_change();
create trigger log_payments      after insert or update or delete on public.payments      for each row execute function public.log_table_change();
create trigger log_invitations   after insert or delete            on public.invitations   for each row execute function public.log_table_change();
create trigger log_organizations after update                      on public.organizations for each row execute function public.log_table_change();

-- ════════════════════════════════════════════════════════════════════════════
-- Directors' summary
-- ════════════════════════════════════════════════════════════════════════════
create function public.directors_summary(p_org uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  if not public.has_role(p_org, 'admin') then raise exception 'Directors only'; end if;
  select jsonb_build_object(
    'collected', coalesce((select sum(amount) from public.payments
                           where org_id = p_org and status = 'confirmed' and paid_on between p_from and p_to), 0),
    'payments_count', (select count(*) from public.payments
                        where org_id = p_org and status = 'confirmed' and paid_on between p_from and p_to),
    'new_sales', (select count(*) from public.subscriptions
                   where org_id = p_org and status <> 'cancelled' and start_date between p_from and p_to
                     and client_number is not null),
    'units_sold', coalesce((select sum(units) from public.subscriptions
                   where org_id = p_org and status <> 'cancelled' and start_date between p_from and p_to
                     and client_number is not null), 0),
    'sales_value', coalesce((select sum(total_price) from public.subscriptions
                   where org_id = p_org and status <> 'cancelled' and start_date between p_from and p_to
                     and client_number is not null), 0),
    'completed', (select count(*) from public.subscriptions s
                   where s.org_id = p_org and s.status = 'completed'
                     and (select max(paid_on) from public.payments x
                           where x.subscription_id = s.id and x.status = 'confirmed') between p_from and p_to),
    'pending_count', (select count(*) from public.payments where org_id = p_org and status = 'pending'),
    'pending_value', coalesce((select sum(amount) from public.payments where org_id = p_org and status = 'pending'), 0),
    'by_property', coalesce((
      select jsonb_agg(row_to_json(t) order by t.collected desc) from (
        select p.name, p.code,
               coalesce((select sum(x.amount) from public.payments x join public.subscriptions s on s.id = x.subscription_id
                          where s.property_id = p.id and x.status = 'confirmed' and x.paid_on between p_from and p_to), 0) as collected,
               coalesce((select sum(s.units) from public.subscriptions s
                          where s.property_id = p.id and s.status <> 'cancelled' and s.client_number is not null
                            and s.start_date between p_from and p_to), 0) as units_sold
        from public.properties p where p.org_id = p_org and p.status <> 'archived') t), '[]'::jsonb),
    'by_staff', coalesce((
      select jsonb_agg(row_to_json(t) order by t.confirmed desc) from (
        select a.actor_name as name, count(*) filter (where a.action = 'payment.confirmed') as confirmed,
               count(*) as actions
        from public.activity_log a
        where a.org_id = p_org and a.actor_id is not null and a.created_at::date between p_from and p_to
        group by a.actor_name) t), '[]'::jsonb)
  ) into v;
  return v;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- Storage: payment proofs (private) and company logos (public)
-- Files are stored under "<org_id>/..." so access follows company membership.
-- ════════════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('payment-proofs', 'payment-proofs', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']),
  ('org-assets',     'org-assets',     true,  2097152,  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

create function public.org_exists(p_org text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organizations where id::text = p_org)
$$;
grant execute on function public.org_exists(text) to anon, authenticated;

create policy "proofs: anyone can upload to a company folder" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'payment-proofs' and public.org_exists((storage.foldername(name))[1]));
create policy "proofs: company members can view" on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and public.is_member(((storage.foldername(name))[1])::uuid));

create policy "logos: admins upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'org-assets' and public.has_role(((storage.foldername(name))[1])::uuid, 'admin'));
create policy "logos: admins replace" on storage.objects for update to authenticated
  using (bucket_id = 'org-assets' and public.has_role(((storage.foldername(name))[1])::uuid, 'admin'));
create policy "logos: admins delete" on storage.objects for delete to authenticated
  using (bucket_id = 'org-assets' and public.has_role(((storage.foldername(name))[1])::uuid, 'admin'));

-- ═══ 20261004000002_demo_data.sql ═══
-- Sample data for demos and trials. Every name here is made up.
-- Only runs on a company with no properties yet.
create function public.seed_demo_data(p_org uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_org public.organizations;
  v_props uuid[] := array[]::uuid[];
  v_plans uuid[] := array[]::uuid[];
  v_prop uuid; v_plan public.payment_plans; v_client uuid; v_sub uuid; v_code text;
  v_names text[] := array[
    'Adaeze Nwankwo', 'Babatunde Adeyemi', 'Chiamaka Eze', 'Damilare Ogunleye', 'Efosa Igbinedion',
    'Funmilayo Bakare', 'Gbenga Alabi', 'Halima Sani', 'Ifeanyi Okafor', 'Jumoke Adebayo',
    'Kelechi Uzor', 'Lola Fashola', 'Musa Abdullahi', 'Ngozi Obi', 'Olumide Coker',
    'Patience Edet', 'Rotimi Ajayi', 'Sade Oyelaran', 'Tobenna Nnaji', 'Uche Madu',
    'Victoria Akpan', 'Wale Ogunbiyi', 'Yetunde Balogun', 'Zainab Bello'];
  v_realtors text[][] := array[['Kunle Ade', 'kunle.realtor@example.com'], ['Grace Effiong', 'grace.realtor@example.com'], ['Segun Lawal', 'segun.realtor@example.com']];
  i int; v_months_ago int; v_units numeric; v_paid_parts int; v_total numeric; v_deposit numeric; v_inst numeric;
  v_start date; v_paid_on date; k int; v_amount numeric; v_seq int; v_status text; v_paid numeric;
begin
  if not public.has_role(p_org, 'admin') then raise exception 'Only admins can load sample data'; end if;
  if exists (select 1 from public.properties where org_id = p_org) then
    raise exception 'Sample data can only be loaded into an empty workspace';
  end if;
  perform set_config('docusend.internal', 'on', true);
  select * into v_org from public.organizations where id = p_org;

  insert into public.properties (org_id, name, code, location, description, unit_type, unit_size_sqm, total_units, status,
                                 bank_name, account_name, account_number)
  values (p_org, 'Palm Grove Estate', 'PG', 'Ibeju-Lekki, Lagos', 'Dry land plots with C of O, 10 minutes from the Lekki Free Trade Zone.', 'plot', 500, 120, 'active',
          'Demo Bank', 'Palm Grove Estate Collection', '0123456789')
  returning id into v_prop; v_props := v_props || v_prop;
  insert into public.properties (org_id, name, code, location, description, unit_type, unit_size_sqm, total_units, status)
  values (p_org, 'Lekki Pearl Apartments', 'LP', 'Lekki Phase 1, Lagos', 'Studio and 2-bedroom serviced apartments.', 'apartment', null, 40, 'active')
  returning id into v_prop; v_props := v_props || v_prop;
  insert into public.properties (org_id, name, code, location, description, unit_type, unit_size_sqm, total_units, status)
  values (p_org, 'Emerald Gardens', 'EG', 'Mowe, Ogun State', 'Affordable residential plots in a gated community.', 'plot', 450, 200, 'pre_launch')
  returning id into v_prop; v_props := v_props || v_prop;

  -- Plans: outright, 6 months, 12 months per property
  for i in 1..3 loop
    insert into public.payment_plans (org_id, property_id, name, duration_months, price_per_unit, min_deposit_percent) values
      (p_org, v_props[i], 'Outright',  0,  (array[4500000, 35000000, 2500000])[i], 0),
      (p_org, v_props[i], '6 months',  6,  (array[5000000, 38000000, 2800000])[i], 30),
      (p_org, v_props[i], '12 months', 12, (array[5500000, 42000000, 3100000])[i], 20);
  end loop;

  for i in 1..array_length(v_names, 1) loop
    v_prop := v_props[1 + (i % 3)];
    select * into v_plan from public.payment_plans
     where property_id = v_prop order by duration_months offset (i % 3) limit 1;
    select code into v_code from public.properties where id = v_prop;
    v_months_ago := 1 + (i * 7) % 13;
    v_start := (current_date - make_interval(months => v_months_ago))::date;
    v_units := 1 + (i % 4 = 0)::int;

    insert into public.clients (org_id, full_name, email, phone, address, occupation, source,
                                next_of_kin_name, next_of_kin_phone, next_of_kin_relationship, created_at)
    values (p_org, v_names[i],
            lower(replace(v_names[i], ' ', '.')) || '@example.com',
            '0803' || lpad(((i * 7919) % 10000000)::text, 7, '0'),
            (array['Lekki, Lagos', 'Ikeja, Lagos', 'Wuse II, Abuja', 'GRA, Port Harcourt', 'Bodija, Ibadan'])[1 + i % 5],
            (array['Banker', 'Engineer', 'Doctor', 'Entrepreneur', 'Civil servant', 'Lawyer'])[1 + i % 6],
            case when i % 3 = 0 then 'manual' else 'form' end,
            'Next of Kin ' || i, '0805' || lpad(((i * 104729) % 10000000)::text, 7, '0'), 'Sibling',
            v_start)
    returning id into v_client;

    insert into public.subscriptions (org_id, client_id, property_id, payment_plan_id, units, plan_name, duration_months,
                                      unit_price, min_deposit_percent, start_date, realtor_name, realtor_email, created_at)
    values (p_org, v_client, v_prop, v_plan.id, v_units, v_plan.name, v_plan.duration_months, v_plan.price_per_unit,
            v_plan.min_deposit_percent, v_start,
            case when i % 4 <> 0 then v_realtors[1 + i % 3][1] end, case when i % 4 <> 0 then v_realtors[1 + i % 3][2] end,
            v_start)
    returning id, total_price into v_sub, v_total;

    -- Clients 22–24 have only just submitted the form: payment awaiting confirmation
    if i > 21 then
      update public.subscriptions set start_date = current_date - (i - 21), created_at = now() - make_interval(days => i - 21) where id = v_sub;
      insert into public.payments (org_id, subscription_id, amount, paid_on, payer_name, bank_reference, source, submitted_at)
      values (p_org, v_sub, case when v_plan.duration_months = 0 then v_total else round(v_total * v_plan.min_deposit_percent / 100, -3) end,
              current_date - (i - 21), v_names[i], 'TRF' || (900000 + i), 'form', now() - make_interval(days => i - 21));
      continue;
    end if;

    update public.organizations set client_seq = client_seq + 1 where id = p_org returning client_seq into v_seq;
    update public.clients set client_seq = v_seq where id = v_client;

    -- How many instalments have been paid: some on time, some behind, some fully paid
    v_deposit := round(v_total * v_plan.min_deposit_percent / 100, 2);
    if v_plan.duration_months = 0 then
      v_paid_parts := 0;
    else
      v_inst := round((v_total - v_deposit) / v_plan.duration_months, 2);
      v_paid_parts := case i % 5
        when 0 then v_plan.duration_months                              -- fully paid
        when 1 then least(v_months_ago, v_plan.duration_months)         -- on track
        when 2 then greatest(least(v_months_ago, v_plan.duration_months) - 1, 0) -- owing
        else greatest(least(v_months_ago, v_plan.duration_months) - 3, 0)        -- behind
      end;
    end if;

    v_paid := 0;
    for k in 0..v_paid_parts loop
      v_amount := case
        when v_plan.duration_months = 0 then v_total
        when k = 0 then v_deposit
        when k = v_plan.duration_months then v_total - v_deposit - v_inst * (v_plan.duration_months - 1)
        else v_inst end;
      exit when v_amount <= 0;
      update public.organizations set receipt_seq = receipt_seq + 1 where id = p_org returning * into v_org;
      -- Clients who paid off early made their last payments recently, never in the future
      v_paid_on := least((v_start + make_interval(months => k))::date, current_date - (v_paid_parts - k));
      insert into public.payments (org_id, subscription_id, amount, paid_on, payer_name, bank_reference, source, status,
                                   receipt_number, submitted_at, reviewed_at)
      values (p_org, v_sub, v_amount, v_paid_on, v_names[i], 'TRF' || (100000 + i * 100 + k),
              case when i % 3 = 0 then 'manual' else 'form' end, 'confirmed',
              v_org.client_prefix || '-RCT-' || lpad(v_org.receipt_seq::text, 5, '0'),
              v_paid_on, v_paid_on + interval '3 hours');
      v_paid := v_paid + v_amount;
    end loop;

    update public.subscriptions
       set client_number = public.format_client_number(v_org.client_prefix, v_code, v_seq),
           status = case when v_paid >= v_total then 'completed' else 'active' end,
           plot_numbers = case when v_paid >= v_total and v_code <> 'LP' then 'Block ' || chr(64 + 1 + i % 5) || ', Plot ' || (10 + i) end
     where id = v_sub;
  end loop;

  update public.organizations set is_demo = true where id = p_org;
  perform public.log_activity(p_org, 'company.sample_data', 'organization', p_org, 'Loaded sample data');
end $$;

-- ═══ 20261004000003_member_profile.sql ═══
-- Team members can edit their own display name, and nothing else on their row
create policy members_update_self on public.members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke update on public.members from authenticated, anon;
grant update (full_name) on public.members to authenticated;

-- ═══ 20261005000001_documents.sql ═══
-- ════════════════════════════════════════════════════════════════════════════
-- Phase 2a: document templates and generated documents
--
-- Companies upload Word templates with {{placeholders}}. A template can apply to
-- the whole company or to one property (a property's own template wins).
-- Documents generated for a client are kept on file under the purchase.
-- ════════════════════════════════════════════════════════════════════════════

create table public.document_templates (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations on delete cascade,
  property_id  uuid,                                   -- null = whole company
  doc_type     text not null check (doc_type in (
                 'acknowledgement', 'contract_of_sale', 'receipt', 'allocation_letter',
                 'deed_of_assignment', 'provisional_survey', 'statement', 'other')),
  name         text not null check (length(trim(name)) between 2 and 120),
  -- When the document is due: the team is prompted at these moments, and the
  -- email phase will send automatically.
  send_on      text not null default 'manual'
               check (send_on in ('first_payment', 'every_payment', 'fully_paid', 'manual')),
  file_path    text not null,
  file_name    text not null,
  is_active    boolean not null default true,
  created_by   uuid references auth.users on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  foreign key (org_id, property_id) references public.properties (org_id, id) on delete cascade
);
create index document_templates_org_idx on public.document_templates (org_id, doc_type);

create table public.documents (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null,
  subscription_id  uuid not null,
  payment_id       uuid references public.payments on delete set null,
  template_id      uuid references public.document_templates on delete set null,
  doc_type         text not null,
  name             text not null,
  file_path        text not null,
  status           text not null default 'generated' check (status in ('generated', 'sent', 'failed')),
  sent_to          text,
  cc               text,
  sent_at          timestamptz,
  error            text,
  created_by       uuid references auth.users on delete set null,
  created_at       timestamptz not null default now(),
  foreign key (org_id, subscription_id) references public.subscriptions (org_id, id) on delete cascade
);
create index documents_subscription_idx on public.documents (subscription_id, created_at desc);

alter table public.document_templates enable row level security;
alter table public.documents          enable row level security;

-- Templates: the whole team uses them; admins manage them
create policy templates_select on public.document_templates for select to authenticated using (public.is_member(org_id));
create policy templates_write  on public.document_templates for all to authenticated
  using (public.has_role(org_id, 'admin')) with check (public.has_role(org_id, 'admin'));

-- Generated documents: anyone on the team can generate and file them
create policy documents_select on public.documents for select to authenticated using (public.is_member(org_id));
create policy documents_insert on public.documents for insert to authenticated
  with check (public.is_member(org_id) and status = 'generated' and sent_at is null);
create policy documents_delete on public.documents for delete to authenticated using (public.has_role(org_id, 'admin'));

-- ─── Activity log ───────────────────────────────────────────────────────────
create function public.log_document_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_row record; v_summary text; v_client text;
begin
  if tg_op = 'DELETE' then v_row := old; else v_row := new; end if;
  if auth.uid() is null then return null; end if;
  if tg_table_name = 'document_templates' then
    v_summary := case tg_op when 'INSERT' then 'Uploaded the template "' when 'UPDATE' then 'Updated the template "' else 'Removed the template "' end
                 || v_row.name || '"';
  else
    select c.full_name into v_client from public.subscriptions s join public.clients c on c.id = s.client_id
     where s.id = v_row.subscription_id;
    v_summary := case tg_op when 'INSERT' then 'Generated ' when 'DELETE' then 'Deleted ' else 'Updated ' end
                 || v_row.name || ' for ' || coalesce(v_client, 'a client');
  end if;
  perform public.log_activity(v_row.org_id, tg_table_name || '.' || lower(tg_op), tg_table_name, v_row.id, v_summary);
  return null;
end $$;

create trigger log_document_templates after insert or update or delete on public.document_templates
  for each row execute function public.log_document_change();
create trigger log_documents after insert or delete on public.documents
  for each row execute function public.log_document_change();

-- ─── Storage ────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('templates', 'templates', false, 10485760,
   array['application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('documents', 'documents', false, 20971520,
   array['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/pdf'])
on conflict (id) do nothing;

create policy "templates: company members can read" on storage.objects for select to authenticated
  using (bucket_id = 'templates' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "templates: admins upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'templates' and public.has_role(((storage.foldername(name))[1])::uuid, 'admin'));
create policy "templates: admins delete" on storage.objects for delete to authenticated
  using (bucket_id = 'templates' and public.has_role(((storage.foldername(name))[1])::uuid, 'admin'));

create policy "documents: company members can read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "documents: company members can file" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "documents: admins delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.has_role(((storage.foldername(name))[1])::uuid, 'admin'));

