-- OM7 Finance OS - Schema 001
-- Base organizacional multiusuario y multiempresa.
-- Ejecutar manualmente en Supabase SQL Editor.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  account_type text not null,
  country text,
  base_currency text default 'CRC',
  owner_id uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'org_owner',
  status text not null default 'active',
  created_at timestamptz default now(),
  unique(organization_id, user_id)
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  legal_name text,
  tax_id text,
  country text,
  base_currency text default 'CRC',
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.company_users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'client_user',
  status text default 'active',
  created_at timestamptz default now(),
  unique(company_id, user_id)
);

create or replace function public.is_org_member(target_organization_id uuid)
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
  );
$$;

create or replace function public.is_org_owner(target_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organizations o
    where o.id = target_organization_id
      and o.owner_id = auth.uid()
  );
$$;

drop function if exists public.create_organization_with_owner(
  text,
  text,
  text,
  text
);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_organizations_updated_at on public.organizations;
create trigger set_organizations_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

drop trigger if exists set_companies_updated_at on public.companies;
create trigger set_companies_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.companies enable row level security;
alter table public.company_users enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "organizations_select_member" on public.organizations;
create policy "organizations_select_member"
on public.organizations for select
to authenticated
using (public.is_org_member(id));

drop policy if exists "organizations_insert_owner" on public.organizations;
create policy "organizations_insert_owner"
on public.organizations for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "organization_members_select_same_org" on public.organization_members;
create policy "organization_members_select_same_org"
on public.organization_members for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "organization_members_insert_self" on public.organization_members;
create policy "organization_members_insert_self"
on public.organization_members for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_org_owner(organization_id)
);

drop policy if exists "companies_select_org_member" on public.companies;
create policy "companies_select_org_member"
on public.companies for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "companies_insert_org_member" on public.companies;
create policy "companies_insert_org_member"
on public.companies for insert
to authenticated
with check (public.is_org_member(organization_id));

drop policy if exists "company_users_select_org_member" on public.company_users;
create policy "company_users_select_org_member"
on public.company_users for select
to authenticated
using (
  exists (
    select 1
    from public.companies c
    where c.id = company_users.company_id
      and public.is_org_member(c.organization_id)
  )
);
