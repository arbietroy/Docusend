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
