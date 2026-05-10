-- OM7 Finance OS - Seed 001
-- Empresa demo con datos de ejemplo para pruebas locales.
-- Ejecutar manualmente en Supabase SQL Editor.

do $$
declare
  target_organization_id uuid;
  target_owner_id uuid;
  demo_company_id uuid;
begin
  select id, owner_id
  into target_organization_id, target_owner_id
  from public.organizations
  order by created_at asc
  limit 1;

  if target_organization_id is null then
    raise exception 'No existe una organizacion. Crea una organizacion desde onboarding antes de correr este seed.';
  end if;

  insert into public.companies (
    organization_id,
    name,
    legal_name,
    tax_id,
    country,
    base_currency,
    status
  )
  values (
    target_organization_id,
    'Cafetal Aurora',
    'Cafetal Aurora Sociedad Anonima',
    '3-101-987654',
    'Costa Rica',
    'CRC',
    'active'
  )
  on conflict do nothing
  returning id into demo_company_id;

  if demo_company_id is null then
    select id
    into demo_company_id
    from public.companies
    where organization_id = target_organization_id
      and tax_id = '3-101-987654'
    limit 1;
  end if;

  if target_owner_id is not null then
    insert into public.company_users (
      company_id,
      user_id,
      role,
      status
    )
    values (
      demo_company_id,
      target_owner_id,
      'admin',
      'active'
    )
    on conflict (company_id, user_id) do nothing;

    insert into public.profiles (id, active_organization_id, active_company_id)
    values (target_owner_id, target_organization_id, demo_company_id)
    on conflict (id) do update set
      active_organization_id = excluded.active_organization_id,
      active_company_id = excluded.active_company_id;
  end if;

  if to_regclass('public.invoices') is not null and target_owner_id is not null then
    insert into public.invoices (
      organization_id,
      company_id,
      user_id,
      tipo_documento,
      proveedor,
      numero_documento,
      fecha,
      moneda,
      subtotal,
      impuesto,
      total,
      estado,
      notas
    )
    values
      (
        target_organization_id,
        demo_company_id,
        target_owner_id,
        'factura',
        'Distribuidora Norte S.A.',
        'FE-001-000184',
        current_date - interval '6 days',
        'CRC',
        385000,
        50050,
        435050,
        'validada',
        'Factura demo para pruebas de dashboard.'
      ),
      (
        target_organization_id,
        demo_company_id,
        target_owner_id,
        'factura',
        'Servicios Contables Prisma',
        'FE-001-000185',
        current_date - interval '2 days',
        'CRC',
        125000,
        16250,
        141250,
        'revision',
        'Servicio profesional mensual.'
      );
  end if;

  if to_regclass('public.purchases') is not null and target_owner_id is not null then
    insert into public.purchases (
      organization_id,
      company_id,
      user_id,
      supplier_name,
      document_number,
      purchase_date,
      category,
      description,
      currency,
      subtotal,
      tax,
      total,
      payment_method,
      status,
      notes
    )
    values
      (
        target_organization_id,
        demo_company_id,
        target_owner_id,
        'Office Market CR',
        'OC-2026-014',
        current_date - interval '9 days',
        'Administrativo',
        'Suministros de oficina',
        'CRC',
        89000,
        11570,
        100570,
        'Tarjeta',
        'registrada',
        'Compra demo para flujo de gastos.'
      ),
      (
        target_organization_id,
        demo_company_id,
        target_owner_id,
        'CloudOps Latam',
        'INV-7782',
        current_date - interval '3 days',
        'Tecnologia',
        'Infraestructura cloud mensual',
        'USD',
        240,
        0,
        240,
        'Transferencia',
        'pendiente',
        'Gasto recurrente demo.'
      ),
      (
        target_organization_id,
        demo_company_id,
        target_owner_id,
        'Mensajeria Express',
        'ME-4510',
        current_date - interval '1 day',
        'Operaciones',
        'Envios locales',
        'CRC',
        42000,
        5460,
        47460,
        'Sinpe',
        'pagada',
        'Servicio operativo demo.'
      );
  end if;
end;
$$;
