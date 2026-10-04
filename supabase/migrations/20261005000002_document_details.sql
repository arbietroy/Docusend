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
