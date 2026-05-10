-- OM7 Finance OS - Schema 009
-- Usuarios cliente y permisos limitados v1.
-- Ejecutar manualmente en Supabase SQL Editor.

alter table public.company_users
add column if not exists invited_at timestamptz default now();

alter table public.company_users
add column if not exists accepted_at timestamptz;

create or replace function public.is_company_user(target_company_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_users cu
    where cu.company_id = target_company_id
      and cu.user_id = auth.uid()
      and cu.status = 'active'
  );
$$;

create or replace function public.is_internal_org_member(target_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role in ('platform_owner', 'org_owner', 'admin', 'accountant', 'assistant')
  );
$$;

create or replace function public.assign_client_to_company(
  target_company_id uuid,
  client_email text
)
returns public.company_users
language plpgsql
security definer
set search_path = public
as $$
declare
  target_company public.companies;
  target_user_id uuid;
  new_company_user public.company_users;
begin
  select *
  into target_company
  from public.companies
  where id = target_company_id;

  if target_company.id is null then
    raise exception 'Empresa no encontrada.';
  end if;

  if not public.is_internal_org_member(target_company.organization_id) then
    raise exception 'No tienes permisos para asignar clientes a esta empresa.';
  end if;

  select id
  into target_user_id
  from public.profiles
  where lower(email) = lower(trim(client_email))
  limit 1;

  if target_user_id is null then
    select id
    into target_user_id
    from auth.users
    where lower(email) = lower(trim(client_email))
    limit 1;
  end if;

  if target_user_id is null then
    raise exception 'No existe un usuario registrado con ese email.';
  end if;

  insert into public.profiles (id, email)
  values (target_user_id, lower(trim(client_email)))
  on conflict (id) do update set
    email = coalesce(public.profiles.email, excluded.email);

  insert into public.company_users (
    company_id,
    user_id,
    role,
    status,
    invited_at,
    accepted_at
  )
  values (
    target_company_id,
    target_user_id,
    'client',
    'active',
    now(),
    now()
  )
  on conflict (company_id, user_id) do update set
    role = 'client',
    status = 'active',
    accepted_at = now()
  returning * into new_company_user;

  return new_company_user;
end;
$$;

grant execute on function public.assign_client_to_company(uuid, text) to authenticated;

drop policy if exists "companies_select_company_user" on public.companies;
create policy "companies_select_company_user"
on public.companies for select
to authenticated
using (public.is_company_user(id));

drop policy if exists "company_users_select_own" on public.company_users;
create policy "company_users_select_own"
on public.company_users for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "documents_select_company_user" on public.documents;
create policy "documents_select_company_user"
on public.documents for select
to authenticated
using (
  public.is_company_user(company_id)
  and related_type = 'client_upload'
);

drop policy if exists "documents_insert_company_user" on public.documents;
create policy "documents_insert_company_user"
on public.documents for insert
to authenticated
with check (
  user_id = auth.uid()
  and related_type = 'client_upload'
  and public.is_company_user(company_id)
  and exists (
    select 1
    from public.companies c
    where c.id = documents.company_id
      and c.organization_id = documents.organization_id
  )
);

drop policy if exists "documents_update_processing_company_user" on public.documents;
create policy "documents_update_processing_company_user"
on public.documents for update
to authenticated
using (
  user_id = auth.uid()
  and related_type = 'client_upload'
  and public.is_company_user(company_id)
)
with check (
  user_id = auth.uid()
  and related_type = 'client_upload'
  and public.is_company_user(company_id)
);

drop policy if exists "document_extractions_select_company_user" on public.document_extractions;
create policy "document_extractions_select_company_user"
on public.document_extractions for select
to authenticated
using (
  public.is_company_user(company_id)
  and exists (
    select 1
    from public.documents d
    where d.id = document_extractions.document_id
      and d.related_type = 'client_upload'
      and d.company_id = document_extractions.company_id
  )
);

drop policy if exists "document_extractions_insert_company_user" on public.document_extractions;
create policy "document_extractions_insert_company_user"
on public.document_extractions for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_company_user(company_id)
  and exists (
    select 1
    from public.documents d
    where d.id = document_extractions.document_id
      and d.related_type = 'client_upload'
      and d.company_id = document_extractions.company_id
  )
);

drop policy if exists "storage_documents_select_company_user" on storage.objects;
create policy "storage_documents_select_company_user"
on storage.objects for select
to authenticated
using (
  bucket_id = 'om7-documents'
  and split_part(name, '/', 1) = 'organizations'
  and split_part(name, '/', 3) = 'companies'
  and split_part(name, '/', 5) = 'documents'
  and public.is_company_user(split_part(name, '/', 4)::uuid)
);

drop policy if exists "storage_documents_insert_company_user" on storage.objects;
create policy "storage_documents_insert_company_user"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'om7-documents'
  and split_part(name, '/', 1) = 'organizations'
  and split_part(name, '/', 3) = 'companies'
  and split_part(name, '/', 5) = 'documents'
  and public.is_company_user(split_part(name, '/', 4)::uuid)
);
