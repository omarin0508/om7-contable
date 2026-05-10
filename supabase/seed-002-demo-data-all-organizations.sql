-- OM7 Finance OS - Seed 002
-- Datos demo visibles para todas las organizaciones y sus miembros activos.
-- Ejecutar manualmente en Supabase SQL Editor si Seed 001 no se ve en la app.

do $$
declare
  org_record record;
  member_record record;
  demo_company_id uuid;
  seed_user_id uuid;
begin
  for org_record in
    select id, owner_id
    from public.organizations
    order by created_at asc
  loop
    seed_user_id := org_record.owner_id;

    if seed_user_id is null then
      select user_id
      into seed_user_id
      from public.organization_members
      where organization_id = org_record.id
        and status = 'active'
      order by created_at asc
      limit 1;
    end if;

    if seed_user_id is null then
      continue;
    end if;

    select id
    into demo_company_id
    from public.companies
    where organization_id = org_record.id
      and tax_id = '3-101-987654'
    limit 1;

    if demo_company_id is null then
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
        org_record.id,
        'Cafetal Aurora',
        'Cafetal Aurora Sociedad Anonima',
        '3-101-987654',
        'Costa Rica',
        'CRC',
        'active'
      )
      returning id into demo_company_id;
    end if;

    for member_record in
      select user_id
      from public.organization_members
      where organization_id = org_record.id
        and status = 'active'
    loop
      insert into public.company_users (
        company_id,
        user_id,
        role,
        status
      )
      values (
        demo_company_id,
        member_record.user_id,
        'admin',
        'active'
      )
      on conflict (company_id, user_id) do nothing;

      insert into public.profiles (
        id,
        active_organization_id,
        active_company_id
      )
      values (
        member_record.user_id,
        org_record.id,
        demo_company_id
      )
      on conflict (id) do update set
        active_organization_id = excluded.active_organization_id,
        active_company_id = excluded.active_company_id;
    end loop;

    if to_regclass('public.invoices') is not null then
      if not exists (
        select 1
        from public.invoices
        where organization_id = org_record.id
          and company_id = demo_company_id
          and numero_documento = 'FE-DEMO-001'
      ) then
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
            org_record.id,
            demo_company_id,
            seed_user_id,
            'factura',
            'Distribuidora Norte S.A.',
            'FE-DEMO-001',
            current_date - interval '6 days',
            'CRC',
            385000,
            50050,
            435050,
            'validada',
            'Factura demo para pruebas de dashboard.'
          ),
          (
            org_record.id,
            demo_company_id,
            seed_user_id,
            'factura',
            'Servicios Contables Prisma',
            'FE-DEMO-002',
            current_date - interval '2 days',
            'CRC',
            125000,
            16250,
            141250,
            'revision',
            'Servicio profesional mensual.'
          );
      end if;
    end if;

    if to_regclass('public.purchases') is not null then
      if not exists (
        select 1
        from public.purchases
        where organization_id = org_record.id
          and company_id = demo_company_id
          and document_number = 'OC-DEMO-001'
      ) then
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
            org_record.id,
            demo_company_id,
            seed_user_id,
            'Office Market CR',
            'OC-DEMO-001',
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
            org_record.id,
            demo_company_id,
            seed_user_id,
            'CloudOps Latam',
            'OC-DEMO-002',
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
            org_record.id,
            demo_company_id,
            seed_user_id,
            'Mensajeria Express',
            'OC-DEMO-003',
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
    end if;
  end loop;
end;
$$;
