-- OM7 Finance OS - Schema 010
-- Invitaciones pendientes para usuarios cliente.
-- Ejecutar manualmente en Supabase SQL Editor.

create table if not exists public.client_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  invited_by uuid references auth.users(id) on delete set null,
  email text not null,
  role text not null default 'client',
  status text not null default 'pending',
  invited_at timestamptz default now(),
  accepted_at timestamptz,
  metadata jsonb default '{}'::jsonb
);

create unique index if not exists client_invitations_company_email_idx
on public.client_invitations (company_id, (lower(email)));

create index if not exists client_invitations_company_status_idx
on public.client_invitations (organization_id, company_id, status);

alter table public.client_invitations enable row level security;

drop policy if exists "client_invitations_select_internal" on public.client_invitations;
create policy "client_invitations_select_internal"
on public.client_invitations for select
to authenticated
using (public.is_internal_org_member(organization_id));

drop policy if exists "client_invitations_insert_internal" on public.client_invitations;
create policy "client_invitations_insert_internal"
on public.client_invitations for insert
to authenticated
with check (
  invited_by = auth.uid()
  and public.is_internal_org_member(organization_id)
);

drop policy if exists "client_invitations_update_internal" on public.client_invitations;
create policy "client_invitations_update_internal"
on public.client_invitations for update
to authenticated
using (public.is_internal_org_member(organization_id))
with check (public.is_internal_org_member(organization_id));

create or replace function public.invite_or_assign_client_to_company(
  target_company_id uuid,
  client_email text
)
returns table (
  company_id uuid,
  user_id uuid,
  email text,
  role text,
  status text,
  invited_at timestamptz,
  accepted_at timestamptz,
  invitation_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_company public.companies;
  target_user_id uuid;
  assigned_user public.company_users;
  normalized_email text;
begin
  normalized_email := lower(trim(client_email));

  if normalized_email = '' then
    raise exception 'Email requerido.';
  end if;

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
  where lower(email) = normalized_email
  limit 1;

  if target_user_id is null then
    select id
    into target_user_id
    from auth.users
    where lower(email) = normalized_email
    limit 1;
  end if;

  if target_user_id is not null then
    insert into public.profiles (id, email)
    values (target_user_id, normalized_email)
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
    returning * into assigned_user;

    update public.client_invitations
    set status = 'accepted',
        accepted_at = now()
    where company_id = target_company_id
      and lower(email) = normalized_email
      and status = 'pending';

    company_id := assigned_user.company_id;
    user_id := assigned_user.user_id;
    email := normalized_email;
    role := assigned_user.role;
    status := assigned_user.status;
    invited_at := assigned_user.invited_at;
    accepted_at := assigned_user.accepted_at;
    invitation_id := null;
    return next;
    return;
  end if;

  insert into public.client_invitations (
    organization_id,
    company_id,
    invited_by,
    email,
    role,
    status,
    invited_at
  )
  values (
    target_company.organization_id,
    target_company_id,
    auth.uid(),
    normalized_email,
    'client',
    'pending',
    now()
  )
  on conflict (company_id, (lower(email))) do update set
    status = 'pending',
    invited_by = auth.uid(),
    invited_at = now(),
    accepted_at = null
  returning
    public.client_invitations.company_id,
    null::uuid,
    public.client_invitations.email,
    public.client_invitations.role,
    public.client_invitations.status,
    public.client_invitations.invited_at,
    public.client_invitations.accepted_at,
    public.client_invitations.id
  into
    company_id,
    user_id,
    email,
    role,
    status,
    invited_at,
    accepted_at,
    invitation_id;

  return next;
end;
$$;

grant execute on function public.invite_or_assign_client_to_company(uuid, text) to authenticated;

create or replace function public.cancel_client_invitation(
  target_invitation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_invitation public.client_invitations;
begin
  select *
  into target_invitation
  from public.client_invitations
  where id = target_invitation_id;

  if target_invitation.id is null then
    raise exception 'Invitacion no encontrada.';
  end if;

  if not public.is_internal_org_member(target_invitation.organization_id) then
    raise exception 'No tienes permisos para cancelar esta invitacion.';
  end if;

  update public.client_invitations
  set status = 'cancelled'
  where id = target_invitation_id;
end;
$$;

grant execute on function public.cancel_client_invitation(uuid) to authenticated;
