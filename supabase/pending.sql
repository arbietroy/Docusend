-- Safe to run more than once.
-- ════════════════════════════════════════════════════════════════════════════
-- Phase 2a: document templates and generated documents
--
-- Companies upload Word templates with {{placeholders}}. A template can apply to
-- the whole company or to one property (a property's own template wins).
-- Documents generated for a client are kept on file under the purchase.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.document_templates (
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
create index if not exists document_templates_org_idx on public.document_templates (org_id, doc_type);

create table if not exists public.documents (
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
create index if not exists documents_subscription_idx on public.documents (subscription_id, created_at desc);

alter table public.document_templates enable row level security;
alter table public.documents          enable row level security;

-- Templates: the whole team uses them; admins manage them
drop policy if exists templates_select on public.document_templates;
create policy templates_select on public.document_templates for select to authenticated using (public.is_member(org_id));
drop policy if exists templates_write on public.document_templates;
create policy templates_write on public.document_templates for all to authenticated
  using (public.has_role(org_id, 'admin')) with check (public.has_role(org_id, 'admin'));

-- Generated documents: anyone on the team can generate and file them
drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents for select to authenticated using (public.is_member(org_id));
drop policy if exists documents_insert on public.documents;
create policy documents_insert on public.documents for insert to authenticated
  with check (public.is_member(org_id) and status = 'generated' and sent_at is null);
drop policy if exists documents_delete on public.documents;
create policy documents_delete on public.documents for delete to authenticated using (public.has_role(org_id, 'admin'));

-- ─── Activity log ───────────────────────────────────────────────────────────
create or replace function public.log_document_change() returns trigger
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

drop trigger if exists log_document_templates on public.document_templates;
create trigger log_document_templates after insert or update or delete on public.document_templates
  for each row execute function public.log_document_change();
drop trigger if exists log_documents on public.documents;
create trigger log_documents after insert or delete on public.documents
  for each row execute function public.log_document_change();

-- ─── Storage ────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('templates', 'templates', false, 10485760,
   array['application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('documents', 'documents', false, 20971520,
   array['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/pdf'])
on conflict (id) do nothing;

drop policy if exists "templates: company members can read" on storage.objects;
create policy "templates: company members can read" on storage.objects for select to authenticated
  using (bucket_id = 'templates' and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "templates: admins upload" on storage.objects;
create policy "templates: admins upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'templates' and public.has_role(((storage.foldername(name))[1])::uuid, 'admin'));
drop policy if exists "templates: admins delete" on storage.objects;
create policy "templates: admins delete" on storage.objects for delete to authenticated
  using (bucket_id = 'templates' and public.has_role(((storage.foldername(name))[1])::uuid, 'admin'));

drop policy if exists "documents: company members can read" on storage.objects;
create policy "documents: company members can read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "documents: company members can file" on storage.objects;
create policy "documents: company members can file" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "documents: admins delete" on storage.objects;
create policy "documents: admins delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.has_role(((storage.foldername(name))[1])::uuid, 'admin'));
-- Details real documents need, learned from sample contracts, receipts and letters:
-- the client's title (Mr., Mrs., Miss…), the company's RC number, and an
-- acknowledgement that goes out as soon as a client submits a payment.
-- Safe to run more than once.

alter table public.clients       add column if not exists title text;
alter table public.organizations add column if not exists rc_number text;

alter table public.document_templates drop constraint if exists document_templates_send_on_check;
alter table public.document_templates add constraint document_templates_send_on_check
  check (send_on in ('form_submitted', 'first_payment', 'every_payment', 'fully_paid', 'manual'));

-- Save the title from the subscription form
create or replace function public.submit_subscription_form(p_slug text, p jsonb)
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
  insert into public.clients (org_id, title, full_name, email, phone, address, occupation, date_of_birth,
                              id_type, id_number, next_of_kin_name, next_of_kin_phone, next_of_kin_relationship, source)
  values (v_org, nullif(trim(p->>'title'), ''), v_name, lower(trim(p->>'email')), p->>'phone', p->>'address', p->>'occupation',
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


-- Sample clients get titles, so sample documents read "his"/"her" correctly
create or replace function public.seed_demo_data(p_org uuid)
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
  v_titles text[] := array[
    'Mrs.', 'Mr.', 'Miss', 'Mr.', 'Dr.', 'Mrs.', 'Chief', 'Mrs.', 'Mr.', 'Miss', 'Engr.', 'Mrs.',
    'Alhaji', 'Mrs.', 'Mr.', 'Miss', 'Mr.', 'Mrs.', 'Mr.', 'Mr.', 'Dr.', 'Mr.', 'Mrs.', 'Miss'];
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

    insert into public.clients (org_id, title, full_name, email, phone, address, occupation, source,
                                next_of_kin_name, next_of_kin_phone, next_of_kin_relationship, created_at)
    values (p_org, v_titles[i], v_names[i],
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
-- ════════════════════════════════════════════════════════════════════════════
-- Realtors and commissions, importing existing clients, and the numbers behind
-- the executive and operations dashboards. Safe to run more than once.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Realtors ───────────────────────────────────────────────────────────────
create table if not exists public.realtors (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations on delete cascade,
  full_name           text not null check (length(trim(full_name)) between 2 and 160),
  email               text,
  phone               text,
  agency              text,
  bank_name           text,
  account_name        text,
  account_number      text,
  commission_percent  numeric(5,2) not null default 0 check (commission_percent between 0 and 100),
  is_active           boolean not null default true,
  notes               text,
  created_by          uuid references auth.users on delete set null,
  created_at          timestamptz not null default now(),
  unique (org_id, id)
);
create unique index if not exists realtors_org_email_idx on public.realtors (org_id, lower(email)) where email is not null;

create table if not exists public.realtor_payouts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null,
  realtor_id  uuid not null,
  amount      numeric(14,2) not null check (amount > 0),
  paid_on     date not null default current_date,
  reference   text,
  notes       text,
  created_by  uuid references auth.users on delete set null,
  created_at  timestamptz not null default now(),
  foreign key (org_id, realtor_id) references public.realtors (org_id, id) on delete cascade
);
create index if not exists realtor_payouts_realtor_idx on public.realtor_payouts (realtor_id);

alter table public.subscriptions add column if not exists realtor_id uuid;
-- A different rate for one sale; otherwise the realtor's own rate applies
alter table public.subscriptions add column if not exists commission_percent numeric(5,2)
  check (commission_percent between 0 and 100);
do $$ begin
  alter table public.subscriptions add constraint subscriptions_realtor_fk
    foreign key (org_id, realtor_id) references public.realtors (org_id, id) on delete set null (realtor_id);
exception when duplicate_object then null; end $$;
create index if not exists subscriptions_realtor_idx on public.subscriptions (realtor_id);

alter table public.realtors        enable row level security;
alter table public.realtor_payouts enable row level security;

-- Everyone sees the directory (to pick a client's realtor); admins manage it.
-- Commission payouts are for admins only.
drop policy if exists realtors_select on public.realtors;
create policy realtors_select on public.realtors for select to authenticated using (public.is_member(org_id));
drop policy if exists realtors_insert on public.realtors;
create policy realtors_insert on public.realtors for insert to authenticated with check (public.is_member(org_id));
drop policy if exists realtors_update on public.realtors;
create policy realtors_update on public.realtors for update to authenticated
  using (public.has_role(org_id, 'admin')) with check (public.has_role(org_id, 'admin'));
drop policy if exists realtors_delete on public.realtors;
create policy realtors_delete on public.realtors for delete to authenticated using (public.has_role(org_id, 'admin'));
drop policy if exists payouts_all on public.realtor_payouts;
create policy payouts_all on public.realtor_payouts for all to authenticated
  using (public.has_role(org_id, 'admin')) with check (public.has_role(org_id, 'admin'));

-- Link each purchase to a realtor record using the details typed on the form:
-- match by email, then phone, then name; create the realtor if they're new.
create or replace function public.find_or_create_realtor(p_org uuid, p_name text, p_email text, p_phone text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_email text := nullif(lower(trim(p_email)), ''); v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
        v_name text := nullif(trim(p_name), '');
begin
  if v_email is not null then
    select id into v_id from public.realtors where org_id = p_org and lower(email) = v_email;
  end if;
  if v_id is null and length(v_phone) >= 7 then
    select id into v_id from public.realtors
     where org_id = p_org and right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10) = right(v_phone, 10) limit 1;
  end if;
  if v_id is null and v_name is not null then
    select id into v_id from public.realtors where org_id = p_org and lower(full_name) = lower(v_name) limit 1;
  end if;
  if v_id is null and coalesce(v_name, v_email) is not null then
    insert into public.realtors (org_id, full_name, email, phone)
    values (p_org, coalesce(v_name, split_part(v_email, '@', 1)), v_email, nullif(trim(p_phone), ''))
    returning id into v_id;
  end if;
  return v_id;
end $$;
revoke execute on function public.find_or_create_realtor(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.link_realtor() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.realtor_id is null and coalesce(new.realtor_name, new.realtor_email, new.realtor_phone) is not null
     and (tg_op = 'INSERT' or new.realtor_name is distinct from old.realtor_name
          or new.realtor_email is distinct from old.realtor_email or new.realtor_phone is distinct from old.realtor_phone) then
    new.realtor_id := public.find_or_create_realtor(new.org_id, new.realtor_name, new.realtor_email, new.realtor_phone);
  end if;
  -- Keep the copied contact details in step with the chosen realtor
  if new.realtor_id is not null and (tg_op = 'INSERT' or new.realtor_id is distinct from old.realtor_id) then
    select full_name, coalesce(new.realtor_email, email), coalesce(new.realtor_phone, phone)
      into new.realtor_name, new.realtor_email, new.realtor_phone
      from public.realtors where id = new.realtor_id;
  end if;
  return new;
end $$;
drop trigger if exists subscriptions_link_realtor on public.subscriptions;
create trigger subscriptions_link_realtor before insert or update on public.subscriptions
  for each row execute function public.link_realtor();

-- Existing purchases: create and link realtors from what was typed so far
update public.subscriptions s
   set realtor_id = public.find_or_create_realtor(s.org_id, s.realtor_name, s.realtor_email, s.realtor_phone)
 where s.realtor_id is null and coalesce(s.realtor_name, s.realtor_email, s.realtor_phone) is not null;

-- Commission: the realtor's rate on every confirmed payment from their clients
create or replace view public.realtor_overview with (security_invoker = true) as
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

-- ─── Balances view: add next instalment amount and the client's title ───────
drop view if exists public.subscription_overview;
create view public.subscription_overview with (security_invoker = true) as
with paid as (
  select subscription_id,
         sum(amount) filter (where status = 'confirmed') as paid,
         sum(amount) filter (where status = 'pending')   as pending,
         max(paid_on) filter (where status = 'confirmed') as last_paid_on
  from public.payments group by subscription_id
), base as (
  select s.*,
         c.full_name as client_name, c.title as client_title, c.email as client_email, c.phone as client_phone, c.client_seq,
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
       case when amount_paid < total_price and first_unpaid_due is not null then
         greatest(round(case when duration_months = 0 then total_price
                             else deposit + (total_price - deposit)
                                  * least(duration_months, (extract(year from age(first_unpaid_due, start_date)) * 12
                                                            + extract(month from age(first_unpaid_due, start_date)))::int)
                                  / duration_months end, 2) - amount_paid, 0)
       end as next_due_amount,
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


-- ─── Import existing clients ────────────────────────────────────────────────
-- One row per purchase. Rows that fail are reported and skipped; the rest are
-- imported. Payments made before DocuSend come in as one confirmed "balance
-- brought forward" payment.
create or replace function public.import_clients(p_org uuid, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r jsonb; i int := 0; v_results jsonb := '[]'::jsonb; v_ok int := 0;
  v_prop public.properties; v_plan public.payment_plans; v_client uuid; v_sub uuid; v_org public.organizations;
  v_units numeric; v_unit_price numeric; v_total numeric; v_paid numeric; v_start date; v_last date;
  v_number text; v_seq int; v_status text; v_email text; v_months int; v_plan_name text; v_deposit numeric;
begin
  if not public.has_role(p_org, 'admin') then raise exception 'Only admins can import clients'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 2000 then
    raise exception 'Import up to 2,000 rows at a time';
  end if;
  perform set_config('docusend.internal', 'on', true);

  for r in select * from jsonb_array_elements(p_rows) loop
    i := i + 1;
    begin
      if length(trim(coalesce(r->>'full_name', ''))) < 2 then raise exception 'Missing client name'; end if;

      select * into v_prop from public.properties
       where org_id = p_org and (upper(code) = upper(trim(r->>'property')) or lower(name) = lower(trim(r->>'property')));
      if not found then raise exception 'Property "%" not found. Use its name or code exactly as in DocuSend', coalesce(r->>'property', ''); end if;

      v_plan := null;
      select * into v_plan from public.payment_plans
       where property_id = v_prop.id and (lower(name) = lower(trim(coalesce(r->>'plan', '')))
             or duration_months = nullif(regexp_replace(coalesce(r->>'plan', ''), '\D', '', 'g'), '')::int)
       order by (lower(name) = lower(trim(coalesce(r->>'plan', '')))) desc limit 1;
      if v_plan.id is null and coalesce(trim(r->>'plan'), '') ~* '^(outright|full|0)' then
        select * into v_plan from public.payment_plans where property_id = v_prop.id and duration_months = 0 limit 1;
      end if;

      v_units := coalesce(nullif(r->>'units', '')::numeric, 1);
      if v_units <= 0 then raise exception 'Units must be more than 0'; end if;
      v_total := nullif(r->>'total_price', '')::numeric;
      v_unit_price := coalesce(nullif(r->>'unit_price', '')::numeric, v_total / v_units, v_plan.price_per_unit);
      if v_unit_price is null or v_unit_price <= 0 then
        raise exception 'No price: add a "Total price" or "Price per unit", or a plan that exists on this property';
      end if;
      v_months := coalesce(v_plan.duration_months, nullif(regexp_replace(coalesce(r->>'plan', ''), '\D', '', 'g'), '')::int, 0);
      v_plan_name := coalesce(v_plan.name, nullif(trim(r->>'plan'), ''), case when v_months = 0 then 'Outright' else v_months || ' months' end);
      v_start := coalesce(nullif(r->>'purchase_date', '')::date, current_date);
      v_paid := coalesce(nullif(r->>'amount_paid', '')::numeric, 0);
      if v_paid < 0 then raise exception 'Amount paid can''t be negative'; end if;
      v_last := coalesce(nullif(r->>'last_payment_date', '')::date, v_start);
      v_email := nullif(lower(trim(r->>'email')), '');

      -- Same email as an existing client: add the purchase to them
      v_client := null;
      if v_email is not null then select id into v_client from public.clients where org_id = p_org and lower(email) = v_email; end if;
      if v_client is null then
        insert into public.clients (org_id, title, full_name, email, phone, address, occupation, source, notes,
                                    next_of_kin_name, next_of_kin_phone, created_by)
        values (p_org, nullif(trim(r->>'title'), ''), trim(r->>'full_name'), v_email, nullif(trim(r->>'phone'), ''),
                nullif(trim(r->>'address'), ''), nullif(trim(r->>'occupation'), ''), 'import', nullif(trim(r->>'notes'), ''),
                nullif(trim(r->>'next_of_kin_name'), ''), nullif(trim(r->>'next_of_kin_phone'), ''), auth.uid())
        returning id into v_client;
      end if;

      -- Keep the company's existing client number if given; otherwise number it
      v_number := nullif(upper(trim(r->>'client_number')), '');
      if v_number is null then
        select client_seq into v_seq from public.clients where id = v_client;
        if v_seq is null then
          update public.organizations set client_seq = client_seq + 1 where id = p_org returning client_seq into v_seq;
          update public.clients set client_seq = v_seq where id = v_client;
        end if;
        select * into v_org from public.organizations where id = p_org;
        v_number := public.format_client_number(v_org.client_prefix, v_prop.code, v_seq);
        if exists (select 1 from public.subscriptions where org_id = p_org and client_number = v_number) then
          v_number := v_number || '-' || (select count(*) + 1 from public.subscriptions where client_id = v_client and property_id = v_prop.id);
        end if;
      elsif exists (select 1 from public.subscriptions where org_id = p_org and client_number = v_number) then
        raise exception 'Client number % is already used', v_number;
      end if;

      v_total := round(v_units * v_unit_price, 2);
      v_status := case when v_paid >= v_total then 'completed' else 'active' end;
      insert into public.subscriptions (org_id, client_id, property_id, payment_plan_id, client_number, units, plan_name,
                                        duration_months, unit_price, min_deposit_percent, start_date, plot_numbers, status,
                                        realtor_name, realtor_email, realtor_phone, created_by)
      values (p_org, v_client, v_prop.id, v_plan.id, v_number, v_units, v_plan_name, v_months, v_unit_price,
              coalesce(v_plan.min_deposit_percent, 0), v_start, nullif(trim(r->>'plot_numbers'), ''), v_status,
              nullif(trim(r->>'realtor_name'), ''), nullif(lower(trim(r->>'realtor_email')), ''), nullif(trim(r->>'realtor_phone'), ''),
              auth.uid())
      returning id into v_sub;

      if v_paid > 0 then
        update public.organizations set receipt_seq = receipt_seq + 1 where id = p_org returning * into v_org;
        insert into public.payments (org_id, subscription_id, amount, paid_on, status, source, receipt_number, notes,
                                     submitted_by, reviewed_by, reviewed_at)
        values (p_org, v_sub, v_paid, v_last, 'confirmed', 'import',
                v_org.client_prefix || '-RCT-' || lpad(v_org.receipt_seq::text, 5, '0'),
                'Payments made before DocuSend (balance brought forward)', auth.uid(), auth.uid(), now());
      end if;

      v_ok := v_ok + 1;
      v_results := v_results || jsonb_build_object('row', i, 'ok', true, 'client_number', v_number);
    exception when others then
      v_results := v_results || jsonb_build_object('row', i, 'ok', false, 'error', sqlerrm);
    end;
  end loop;

  -- New clients shouldn't reuse numbers that came in with the import
  update public.organizations o
     set client_seq = greatest(o.client_seq, coalesce((
           select max(nullif(substring(s.client_number from '(\d+)$'), '')::int) from public.subscriptions s
            where s.org_id = p_org and s.client_number like o.client_prefix || '-%'), 0))
   where o.id = p_org;

  if v_ok > 0 then
    perform public.log_activity(p_org, 'clients.imported', 'organization', p_org, 'Imported ' || v_ok || ' client purchase(s) from a spreadsheet');
  end if;
  return jsonb_build_object('imported', v_ok, 'failed', i - v_ok, 'rows', v_results);
end $$;

-- ─── Executive dashboard ────────────────────────────────────────────────────
create or replace function public.executive_summary(p_org uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  if not public.has_role(p_org, 'admin') then raise exception 'Directors only'; end if;
  with subs as (
    select s.*, (select coalesce(sum(amount), 0) from public.payments x where x.subscription_id = s.id and x.status = 'confirmed') as paid
    from public.subscriptions s where s.org_id = p_org and s.status in ('active', 'completed')
  ), months as (
    select generate_series(date_trunc('month', p_to::timestamp) - interval '11 months', date_trunc('month', p_to::timestamp), interval '1 month')::date as m
  )
  select jsonb_build_object(
    'collected', coalesce((select sum(amount) from public.payments where org_id = p_org and status = 'confirmed' and paid_on between p_from and p_to), 0),
    'new_sales', (select count(*) from subs where start_date between p_from and p_to),
    'sales_value', coalesce((select sum(total_price) from subs where start_date between p_from and p_to), 0),
    'units_sold_period', coalesce((select sum(units) from subs where start_date between p_from and p_to), 0),
    'units_total', coalesce((select sum(total_units) from public.properties where org_id = p_org and status <> 'archived'), 0),
    'units_sold_total', coalesce((select sum(units) from subs s join public.properties p on p.id = s.property_id where p.status <> 'archived'), 0),
    'contract_value', coalesce((select sum(total_price) from subs), 0),
    'collected_total', coalesce((select sum(paid) from subs), 0),
    'outstanding', coalesce((select sum(greatest(total_price - paid, 0)) from subs), 0),
    'pending_count', (select count(*) from public.payments where org_id = p_org and status = 'pending'),
    'pending_value', coalesce((select sum(amount) from public.payments where org_id = p_org and status = 'pending'), 0),
    'monthly', (select jsonb_agg(jsonb_build_object(
        'month', to_char(m, 'YYYY-MM'),
        'collected', coalesce((select sum(amount) from public.payments x where x.org_id = p_org and x.status = 'confirmed'
                                and date_trunc('month', x.paid_on) = m), 0),
        'sales', coalesce((select sum(total_price) from subs where date_trunc('month', start_date) = m), 0)) order by m)
      from months),
    'properties', coalesce((select jsonb_agg(row_to_json(t) order by t.sales_value desc) from (
        select p.name, p.code, p.unit_type, p.total_units,
               coalesce(sum(s.units), 0) as units_sold, coalesce(sum(s.total_price), 0) as sales_value,
               coalesce(sum(s.paid), 0) as collected, coalesce(sum(greatest(s.total_price - s.paid, 0)), 0) as outstanding
        from public.properties p left join subs s on s.property_id = p.id
        where p.org_id = p_org and p.status <> 'archived'
        group by p.id) t), '[]'::jsonb),
    'top_realtors', coalesce((select jsonb_agg(row_to_json(t)) from (
        select r.full_name as name, count(*) as sales, sum(s.total_price) as sales_value
        from subs s join public.realtors r on r.id = s.realtor_id
        where s.start_date between p_from and p_to
        group by r.id order by sum(s.total_price) desc limit 5) t), '[]'::jsonb)
  ) into v;
  return v;
end $$;

-- ─── Activity log for realtors and payouts ──────────────────────────────────
create or replace function public.log_realtor_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_row record; v_summary text; v_name text;
begin
  if tg_op = 'DELETE' then v_row := old; else v_row := new; end if;
  if auth.uid() is null or current_setting('docusend.internal', true) = 'on' then return null; end if;
  if tg_table_name = 'realtors' then
    v_summary := case tg_op when 'INSERT' then 'Added realtor ' when 'UPDATE' then 'Updated realtor ' else 'Removed realtor ' end || v_row.full_name;
  else
    select full_name into v_name from public.realtors where id = v_row.realtor_id;
    v_summary := case tg_op when 'DELETE' then 'Deleted a commission payout of ' else 'Recorded a commission payout of ' end
                 || public.format_naira(v_row.amount) || ' to ' || coalesce(v_name, 'a realtor');
  end if;
  perform public.log_activity(v_row.org_id, tg_table_name || '.' || lower(tg_op), tg_table_name, v_row.id, v_summary);
  return null;
end $$;
drop trigger if exists log_realtors on public.realtors;
create trigger log_realtors after insert or update or delete on public.realtors
  for each row execute function public.log_realtor_change();
drop trigger if exists log_realtor_payouts on public.realtor_payouts;
create trigger log_realtor_payouts after insert or delete on public.realtor_payouts
  for each row execute function public.log_realtor_change();

-- ─── Sample data: give sample realtors a commission rate ────────────────────
create or replace function public.seed_demo_data(p_org uuid)
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
  v_titles text[] := array[
    'Mrs.', 'Mr.', 'Miss', 'Mr.', 'Dr.', 'Mrs.', 'Chief', 'Mrs.', 'Mr.', 'Miss', 'Engr.', 'Mrs.',
    'Alhaji', 'Mrs.', 'Mr.', 'Miss', 'Mr.', 'Mrs.', 'Mr.', 'Mr.', 'Dr.', 'Mr.', 'Mrs.', 'Miss'];
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

    insert into public.clients (org_id, title, full_name, email, phone, address, occupation, source,
                                next_of_kin_name, next_of_kin_phone, next_of_kin_relationship, created_at)
    values (p_org, v_titles[i], v_names[i],
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

  -- Sample realtors (created from the purchases above) earn 5% commission
  update public.realtors set commission_percent = 5, agency = 'Independent'
   where org_id = p_org and commission_percent = 0;
  update public.organizations set is_demo = true where id = p_org;
  perform public.log_activity(p_org, 'company.sample_data', 'organization', p_org, 'Loaded sample data');
end $$;
