-- OM7 Finance OS - Schema 040
-- Prueba inicial de conexion Gmail para lectura basica de XML.
-- Ejecutar manualmente en Supabase SQL Editor.

create table if not exists public.gmail_xml_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  gmail_email text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  connected_at timestamptz default now(),
  last_test_at timestamptz,
  last_list_at timestamptz,
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint gmail_xml_connections_unique_org_user
    unique (organization_id, user_id)
);

alter table public.gmail_xml_connections
add column if not exists company_id uuid references public.companies(id) on delete set null;

alter table public.gmail_xml_connections
alter column company_id drop not null;

alter table public.gmail_xml_connections
add column if not exists last_test_at timestamptz;

alter table public.gmail_xml_connections
add column if not exists last_list_at timestamptz;

alter table public.gmail_xml_connections
drop constraint if exists gmail_xml_connections_unique_user_company;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'gmail_xml_connections_unique_org_user'
  ) then
    alter table public.gmail_xml_connections
    add constraint gmail_xml_connections_unique_org_user
      unique (organization_id, user_id);
  end if;
end;
$$;

drop trigger if exists set_gmail_xml_connections_updated_at on public.gmail_xml_connections;
create trigger set_gmail_xml_connections_updated_at
before update on public.gmail_xml_connections
for each row execute function public.set_updated_at();

alter table public.gmail_xml_connections enable row level security;

drop policy if exists "gmail_xml_connections_select_owner" on public.gmail_xml_connections;
create policy "gmail_xml_connections_select_owner"
on public.gmail_xml_connections for select
to authenticated
using (
  user_id = auth.uid()
  and public.is_org_member(organization_id)
);

drop policy if exists "gmail_xml_connections_insert_owner" on public.gmail_xml_connections;
create policy "gmail_xml_connections_insert_owner"
on public.gmail_xml_connections for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_org_member(organization_id)
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active_organization_id = gmail_xml_connections.organization_id
  )
);

drop policy if exists "gmail_xml_connections_update_owner" on public.gmail_xml_connections;
create policy "gmail_xml_connections_update_owner"
on public.gmail_xml_connections for update
to authenticated
using (
  user_id = auth.uid()
  and public.is_org_member(organization_id)
)
with check (
  user_id = auth.uid()
  and public.is_org_member(organization_id)
);

create index if not exists gmail_xml_connections_context_idx
on public.gmail_xml_connections (organization_id, user_id, active);
