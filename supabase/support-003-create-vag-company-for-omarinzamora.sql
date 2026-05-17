do $$
declare
  target_email text := 'omarinzamora@gmail.com';
  target_user_id uuid;
  target_organization_id uuid;
  target_company_id uuid;
begin
  select id
  into target_user_id
  from auth.users
  where lower(email) = lower(target_email)
  limit 1;

  if target_user_id is null then
    raise exception 'No existe usuario auth para %.', target_email;
  end if;

  select active_organization_id
  into target_organization_id
  from public.profiles
  where id = target_user_id;

  if target_organization_id is null then
    select organization_id
    into target_organization_id
    from public.organization_members
    where user_id = target_user_id
      and status = 'active'
    order by created_at asc nulls last
    limit 1;
  end if;

  if target_organization_id is null then
    raise exception 'El usuario % no tiene organizacion activa.', target_email;
  end if;

  select id
  into target_company_id
  from public.companies
  where organization_id = target_organization_id
    and lower(coalesce(name, '') || ' ' || coalesce(legal_name, '')) like '%vag%'
  order by created_at asc nulls last
  limit 1;

  if target_company_id is null then
    insert into public.companies (
      organization_id,
      name,
      legal_name,
      country,
      base_currency,
      status,
      gmail_xml_enabled
    )
    values (
      target_organization_id,
      'VAG Producciones',
      'VAG Producciones S.A.',
      'Costa Rica',
      'CRC',
      'active',
      true
    )
    returning id into target_company_id;
  else
    update public.companies
    set
      gmail_xml_enabled = true,
      status = coalesce(status, 'active')
    where id = target_company_id;
  end if;

  update public.profiles
  set
    active_organization_id = target_organization_id,
    active_company_id = target_company_id
  where id = target_user_id;

  update public.gmail_xml_connections
  set company_id = target_company_id
  where organization_id = target_organization_id
    and user_id = target_user_id
    and company_id is null;
end;
$$;

notify pgrst, 'reload schema';
