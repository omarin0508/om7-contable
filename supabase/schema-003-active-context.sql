-- OM7 Finance OS - Schema 003
-- Preferencias de contexto activo por usuario.
-- Ejecutar manualmente en Supabase SQL Editor.

alter table public.profiles
add column if not exists active_organization_id uuid
references public.organizations(id) on delete set null;

alter table public.profiles
add column if not exists active_company_id uuid
references public.companies(id) on delete set null;

create or replace function public.is_company_in_user_org(target_company_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.companies c
    where c.id = target_company_id
      and public.is_org_member(c.organization_id)
  );
$$;

drop policy if exists "profiles_update_active_context" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and (
    active_organization_id is null
    or public.is_org_member(active_organization_id)
  )
  and (
    active_company_id is null
    or exists (
      select 1
      from public.companies c
      where c.id = active_company_id
        and public.is_org_member(c.organization_id)
        and (
          active_organization_id is null
          or c.organization_id = active_organization_id
        )
    )
  )
);
