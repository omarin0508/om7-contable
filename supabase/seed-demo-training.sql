-- OM7 Finance OS - Demo Training Multiempresa
-- DEMO / TRAINING / SEED. Ejecutar manualmente en Supabase SQL Editor.
--
-- Objetivo:
-- - Asociar el usuario demo Sergio Demo o QA E7 a varias empresas/clientes.
-- - Crear datos operativos distintos por empresa para probar contexto multiempresa.
-- - Mantener idempotencia: puede ejecutarse varias veces sin duplicar datos clave.

do $$
declare
  org_record record;
  member_record record;
  company_record record;
  seed_user_id uuid;
  first_demo_company_id uuid;
  target_company_id uuid;
  purchase_id uuid;
  entry_id uuid;
  manual_asiento_id uuid;
  demo_accounts jsonb := '[
    {"code":"D-100-BANCO","name":"Banco demo operativo","type":"bank","normal_balance":"debit"},
    {"code":"D-110-COBRAR","name":"Cuentas por cobrar demo","type":"asset","normal_balance":"debit"},
    {"code":"D-120-IVA-CRED","name":"IVA credito fiscal demo","type":"tax","normal_balance":"debit"},
    {"code":"D-200-PAGAR","name":"Cuentas por pagar demo","type":"liability","normal_balance":"credit"},
    {"code":"D-210-IVA-DEB","name":"IVA debito fiscal demo","type":"tax","normal_balance":"credit"},
    {"code":"D-400-VENTAS","name":"Ingresos operativos demo","type":"income","normal_balance":"credit"},
    {"code":"D-500-GASTOS","name":"Gastos operativos demo","type":"expense","normal_balance":"debit"}
  ]'::jsonb;
  account_record record;
  debit_account_id uuid;
  credit_account_id uuid;
  iva_credit_account_id uuid;
  accounts_payable_id uuid;
begin
  for org_record in
    select o.id, o.owner_id
    from public.organizations o
    where exists (
      select 1
      from public.organization_members om
      left join public.profiles p on p.id = om.user_id
      left join auth.users u on u.id = om.user_id
      where om.organization_id = o.id
        and om.status = 'active'
        and (
          lower(coalesce(p.full_name, '')) like '%sergio%demo%'
          or lower(coalesce(p.full_name, '')) like '%sergio%'
          or lower(coalesce(p.email, u.email, '')) like '%sergio%'
          or lower(coalesce(p.email, u.email, '')) = 'qa.e7@om7.local'
          or lower(coalesce(u.email, '')) like '%demo%'
        )
    )
    or not exists (
      select 1
      from public.organization_members om
      left join public.profiles p on p.id = om.user_id
      left join auth.users u on u.id = om.user_id
      where om.status = 'active'
        and (
          lower(coalesce(p.full_name, '')) like '%sergio%demo%'
          or lower(coalesce(p.full_name, '')) like '%sergio%'
          or lower(coalesce(p.email, u.email, '')) like '%sergio%'
          or lower(coalesce(p.email, u.email, '')) = 'qa.e7@om7.local'
          or lower(coalesce(u.email, '')) like '%demo%'
        )
    )
    order by o.created_at asc
  loop
    select om.user_id
    into seed_user_id
    from public.organization_members om
    left join public.profiles p on p.id = om.user_id
    left join auth.users u on u.id = om.user_id
    where om.organization_id = org_record.id
      and om.status = 'active'
    order by
      case
        when lower(coalesce(p.full_name, '')) like '%sergio%demo%' then 0
        when lower(coalesce(p.full_name, '')) like '%sergio%' then 1
        when lower(coalesce(p.email, u.email, '')) = 'qa.e7@om7.local' then 2
        when lower(coalesce(p.email, u.email, '')) like '%sergio%' then 3
        else 4
      end,
      om.created_at asc
    limit 1;

    if seed_user_id is null then
      seed_user_id := org_record.owner_id;
    end if;

    if seed_user_id is null then
      continue;
    end if;

    first_demo_company_id := null;

    for company_record in
      select *
      from jsonb_to_recordset('[
        {
          "name":"VAG Producciones",
          "legal_name":"VAG Producciones S.A.",
          "tax_id":"3-101-800001",
          "industry":"productora/eventos",
          "notes":"Eventos, produccion audiovisual y alquiler de equipo."
        },
        {
          "name":"Constructora Nova CR",
          "legal_name":"Constructora Nova CR S.A.",
          "tax_id":"3-101-800002",
          "industry":"construccion",
          "notes":"Obras civiles, materiales, subcontratos y maquinaria."
        },
        {
          "name":"Cafe Montana Verde",
          "legal_name":"Cafe Montana Verde S.R.L.",
          "tax_id":"3-102-800003",
          "industry":"restaurante/cafeteria",
          "notes":"Cafeteria, restaurante, POS y compras recurrentes."
        },
        {
          "name":"TechPoint Solutions",
          "legal_name":"TechPoint Solutions S.A.",
          "tax_id":"3-101-800004",
          "industry":"tecnologia/servicios",
          "notes":"Servicios cloud, licencias, soporte y consultoria."
        }
      ]'::jsonb) as item(
        name text,
        legal_name text,
        tax_id text,
        industry text,
        notes text
      )
    loop
      select id
      into target_company_id
      from public.companies
      where organization_id = org_record.id
        and tax_id = company_record.tax_id
      limit 1;

      if target_company_id is null then
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
          company_record.name,
          company_record.legal_name,
          company_record.tax_id,
          'Costa Rica',
          'CRC',
          'active'
        )
        returning id into target_company_id;
      else
        update public.companies
        set
          name = company_record.name,
          legal_name = company_record.legal_name,
          country = 'Costa Rica',
          base_currency = 'CRC',
          status = 'active',
          updated_at = now()
        where id = target_company_id;
      end if;

      if first_demo_company_id is null then
        first_demo_company_id := target_company_id;
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
          target_company_id,
          member_record.user_id,
          'admin',
          'active'
        )
        on conflict (company_id, user_id) do update set
          role = excluded.role,
          status = excluded.status;
      end loop;

      if to_regclass('public.accounting_periods') is not null then
        insert into public.accounting_periods (
          organization_id,
          company_id,
          period_year,
          period_month,
          status,
          notes
        )
        values
          (org_record.id, target_company_id, extract(year from current_date)::int, extract(month from current_date)::int, 'open', 'DEMO TRAINING - periodo operativo actual.'),
          (org_record.id, target_company_id, extract(year from current_date - interval '1 month')::int, extract(month from current_date - interval '1 month')::int, 'in_review', 'DEMO TRAINING - periodo anterior en revision.')
        on conflict (organization_id, company_id, period_year, period_month) do update set
          status = excluded.status,
          notes = excluded.notes,
          updated_at = now();
      end if;

      if to_regclass('public.counterparties') is not null then
        insert into public.counterparties (
          organization_id,
          company_id,
          type,
          name,
          normalized_name,
          tax_id,
          normalized_tax_id,
          email,
          phone,
          source,
          default_category,
          default_account,
          is_active,
          notes
        )
        select
          org_record.id,
          target_company_id,
          item.type,
          item.name || ' - ' || company_record.name,
          lower(item.name || ' - ' || company_record.name),
          item.tax_id,
          regexp_replace(item.tax_id, '[^0-9A-Za-z]', '', 'g'),
          item.email,
          item.phone,
          'imported',
          item.category,
          item.account,
          true,
          'DEMO TRAINING - ' || company_record.industry
        from jsonb_to_recordset(
          case company_record.tax_id
            when '3-101-800001' then '[
              {"type":"supplier","name":"AudioLux Rental","tax_id":"3-101-610010","email":"eventos@audiolux.cr","phone":"+506 2200-1100","category":"Alquiler equipo","account":"D-500-GASTOS"},
              {"type":"supplier","name":"ICE Telecom","tax_id":"4-000-042139","email":"empresas@ice.go.cr","phone":"1193","category":"Servicios publicos","account":"D-500-GASTOS"},
              {"type":"customer","name":"Festival Urbano CR","tax_id":"3-101-620010","email":"admin@festivalurbano.cr","phone":"+506 2210-4550","category":"Eventos","account":"D-400-VENTAS"}
            ]'::jsonb
            when '3-101-800002' then '[
              {"type":"supplier","name":"Ferreteria EPA","tax_id":"3-101-102030","email":"empresas@epa.cr","phone":"+506 2205-1500","category":"Materiales","account":"D-500-GASTOS"},
              {"type":"supplier","name":"Maquinaria Atlas","tax_id":"3-101-303040","email":"rentas@atlas.cr","phone":"+506 2290-8080","category":"Maquinaria","account":"D-500-GASTOS"},
              {"type":"customer","name":"Desarrollos Rio Norte","tax_id":"3-101-505060","email":"finanzas@rionorte.cr","phone":"+506 2222-6677","category":"Proyecto construccion","account":"D-400-VENTAS"}
            ]'::jsonb
            when '3-102-800003' then '[
              {"type":"supplier","name":"Distribuidora Alimentos Selectos","tax_id":"3-101-707080","email":"pedidos@alimentosselectos.cr","phone":"+506 2233-0101","category":"Alimentos","account":"D-500-GASTOS"},
              {"type":"supplier","name":"Coopedota Cafe","tax_id":"3-004-045678","email":"ventas@coopedota.co.cr","phone":"+506 2541-2828","category":"Materia prima","account":"D-500-GASTOS"},
              {"type":"customer","name":"Hotel Bosque Alto","tax_id":"3-101-909010","email":"compras@bosquealto.cr","phone":"+506 2444-1919","category":"Cliente recurrente","account":"D-400-VENTAS"}
            ]'::jsonb
            else '[
              {"type":"supplier","name":"AWS Costa Rica","tax_id":"3-102-111213","email":"billing@aws.example","phone":"+506 4000-0101","category":"Cloud","account":"D-500-GASTOS"},
              {"type":"supplier","name":"Adobe LATAM","tax_id":"3-102-141516","email":"billing@adobe.example","phone":"+506 4000-0202","category":"Licencias","account":"D-500-GASTOS"},
              {"type":"customer","name":"Fintech Prisma","tax_id":"3-101-171819","email":"ops@fintechprisma.cr","phone":"+506 4000-3030","category":"Consultoria","account":"D-400-VENTAS"}
            ]'::jsonb
          end
        ) as item(
          type text,
          name text,
          tax_id text,
          email text,
          phone text,
          category text,
          account text
        )
        on conflict (organization_id, normalized_name) where normalized_name <> '' do update set
          company_id = excluded.company_id,
          type = excluded.type,
          tax_id = excluded.tax_id,
          normalized_tax_id = excluded.normalized_tax_id,
          email = excluded.email,
          phone = excluded.phone,
          default_category = excluded.default_category,
          default_account = excluded.default_account,
          is_active = true,
          notes = excluded.notes,
          updated_at = now();
      end if;

      if to_regclass('public.documents') is not null then
        insert into public.documents (
          organization_id,
          company_id,
          user_id,
          related_type,
          original_filename,
          display_name,
          storage_path,
          mime_type,
          size_bytes,
          document_type,
          processing_status,
          review_status,
          review_notes,
          notes,
          metadata
        )
        select
          org_record.id,
          target_company_id,
          seed_user_id,
          'client_upload',
          item.filename,
          item.display_name,
          'organizations/' || org_record.id || '/companies/' || target_company_id || '/documents/demo-training/' || item.filename,
          item.mime_type,
          item.size_bytes,
          item.document_type,
          item.processing_status,
          item.review_status,
          item.review_notes,
          'DEMO TRAINING - documento simulado para ' || company_record.name,
          jsonb_build_object(
            'seed', 'demo_training_multiempresa',
            'company_type', company_record.industry,
            'demo_state', item.review_status
          )
        from jsonb_to_recordset(
          case company_record.tax_id
            when '3-101-800001' then '[
              {"filename":"vag-audiolux-alquiler.xml","display_name":"Alquiler equipo AudioLux","mime_type":"application/xml","size_bytes":18420,"document_type":"xml","processing_status":"completed","review_status":"approved","review_notes":"Convertido a compra demo."},
              {"filename":"vag-festival-servicios.pdf","display_name":"Factura servicios Festival Urbano","mime_type":"application/pdf","size_bytes":322100,"document_type":"factura","processing_status":"completed","review_status":"pending","review_notes":"Pendiente de revision de cliente."},
              {"filename":"vag-ice-telefonia.xml","display_name":"Servicio ICE produccion","mime_type":"application/xml","size_bytes":16400,"document_type":"xml","processing_status":"failed","review_status":"observed","review_notes":"XML observado por centro de costo faltante."}
            ]'::jsonb
            when '3-101-800002' then '[
              {"filename":"nova-epa-materiales.xml","display_name":"Materiales obra EPA","mime_type":"application/xml","size_bytes":25100,"document_type":"xml","processing_status":"completed","review_status":"approved","review_notes":"Listo para contabilizar."},
              {"filename":"nova-atlas-maquinaria.pdf","display_name":"Renta maquinaria Atlas","mime_type":"application/pdf","size_bytes":411200,"document_type":"factura","processing_status":"pending","review_status":"pending","review_notes":"Esperando OCR."},
              {"filename":"nova-subcontrato-electricidad.pdf","display_name":"Subcontrato electricidad","mime_type":"application/pdf","size_bytes":538900,"document_type":"contrato","processing_status":"completed","review_status":"observed","review_notes":"Validar retenciones."}
            ]'::jsonb
            when '3-102-800003' then '[
              {"filename":"cafe-coopedota-cafe.xml","display_name":"Compra cafe Coopedota","mime_type":"application/xml","size_bytes":19100,"document_type":"xml","processing_status":"completed","review_status":"approved","review_notes":"Compra recurrente aprobada."},
              {"filename":"cafe-alimentos-selectos.xml","display_name":"Insumos restaurante","mime_type":"application/xml","size_bytes":17880,"document_type":"xml","processing_status":"completed","review_status":"pending","review_notes":"Pendiente clasificacion."},
              {"filename":"cafe-servicios-publicos.pdf","display_name":"Servicios publicos local","mime_type":"application/pdf","size_bytes":126000,"document_type":"recibo","processing_status":"completed","review_status":"reviewed","review_notes":"Revisado sin observaciones."}
            ]'::jsonb
            else '[
              {"filename":"techpoint-aws-cloud.xml","display_name":"AWS cloud mensual","mime_type":"application/xml","size_bytes":20600,"document_type":"xml","processing_status":"completed","review_status":"approved","review_notes":"Gasto cloud aprobado."},
              {"filename":"techpoint-adobe-licencias.pdf","display_name":"Licencias Adobe","mime_type":"application/pdf","size_bytes":228000,"document_type":"factura","processing_status":"completed","review_status":"pending","review_notes":"Pendiente confirmar usuario."},
              {"filename":"techpoint-consultoria-prisma.xml","display_name":"Servicios Fintech Prisma","mime_type":"application/xml","size_bytes":19800,"document_type":"xml","processing_status":"completed","review_status":"reviewed","review_notes":"Ingreso revisado."}
            ]'::jsonb
          end
        ) as item(
          filename text,
          display_name text,
          mime_type text,
          size_bytes bigint,
          document_type text,
          processing_status text,
          review_status text,
          review_notes text
        )
        where not exists (
          select 1
          from public.documents existing
          where existing.organization_id = org_record.id
            and existing.company_id = target_company_id
            and existing.storage_path = 'organizations/' || org_record.id || '/companies/' || target_company_id || '/documents/demo-training/' || item.filename
        );

        update public.documents
        set
          related_type = 'client_upload',
          notes = coalesce(notes, 'DEMO TRAINING - documento visible en bandeja diaria.'),
          metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
            'seed', 'demo_training_multiempresa',
            'visible_in_daily_inbox', true
          )
        where organization_id = org_record.id
          and company_id = target_company_id
          and storage_path like 'organizations/' || org_record.id || '/companies/' || target_company_id || '/documents/demo-training/%';
      end if;

      if to_regclass('public.purchases') is not null then
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
          review_status,
          review_notes,
          suggested_account,
          classification_confidence,
          estado_contable,
          notes
        )
        select
          org_record.id,
          target_company_id,
          seed_user_id,
          item.supplier_name,
          item.document_number,
          current_date - (item.days_ago || ' days')::interval,
          item.category,
          item.description,
          'CRC',
          item.subtotal,
          item.tax,
          item.total,
          item.payment_method,
          item.status,
          item.review_status,
          item.review_notes,
          'D-500-GASTOS',
          item.confidence,
          item.estado_contable,
          'DEMO TRAINING - ' || company_record.industry
        from jsonb_to_recordset(
          case company_record.tax_id
            when '3-101-800001' then '[
              {"supplier_name":"AudioLux Rental - VAG Producciones","document_number":"VAG-COMP-001","days_ago":11,"category":"Alquiler equipo","description":"Alquiler de luces y audio para evento corporativo","subtotal":680000,"tax":88400,"total":768400,"payment_method":"Transferencia","status":"registrada","review_status":"approved","review_notes":"Aprobado y listo para pago.","confidence":94.50,"estado_contable":"contabilizado"},
              {"supplier_name":"ICE Telecom - VAG Producciones","document_number":"VAG-COMP-002","days_ago":3,"category":"Servicios publicos","description":"Internet movil para produccion en campo","subtotal":42000,"tax":5460,"total":47460,"payment_method":"Sinpe","status":"pendiente","review_status":"observed","review_notes":"Falta centro de costo del evento.","confidence":83.25,"estado_contable":"pendiente"}
            ]'::jsonb
            when '3-101-800002' then '[
              {"supplier_name":"Ferreteria EPA - Constructora Nova CR","document_number":"NOVA-COMP-001","days_ago":9,"category":"Materiales","description":"Varilla, cemento y formaleta para obra Rio Norte","subtotal":1250000,"tax":162500,"total":1412500,"payment_method":"Credito proveedor","status":"registrada","review_status":"approved","review_notes":"Materiales verificados contra orden de compra.","confidence":96.00,"estado_contable":"borrador"},
              {"supplier_name":"Maquinaria Atlas - Constructora Nova CR","document_number":"NOVA-COMP-002","days_ago":2,"category":"Maquinaria","description":"Renta excavadora por avance de obra","subtotal":820000,"tax":106600,"total":926600,"payment_method":"Transferencia","status":"pendiente","review_status":"pending","review_notes":"Pendiente validar horas maquina.","confidence":77.50,"estado_contable":"pendiente"}
            ]'::jsonb
            when '3-102-800003' then '[
              {"supplier_name":"Coopedota Cafe - Cafe Montana Verde","document_number":"CAFE-COMP-001","days_ago":7,"category":"Materia prima","description":"Compra de cafe especial para inventario","subtotal":210000,"tax":27300,"total":237300,"payment_method":"Transferencia","status":"pagada","review_status":"approved","review_notes":"Compra recurrente conciliada.","confidence":98.10,"estado_contable":"contabilizado"},
              {"supplier_name":"Distribuidora Alimentos Selectos - Cafe Montana Verde","document_number":"CAFE-COMP-002","days_ago":1,"category":"Alimentos","description":"Leche, panaderia e insumos de cocina","subtotal":155000,"tax":20150,"total":175150,"payment_method":"Tarjeta","status":"registrada","review_status":"pending","review_notes":"Pendiente separar insumos gravados/exentos.","confidence":88.00,"estado_contable":"pendiente"}
            ]'::jsonb
            else '[
              {"supplier_name":"AWS Costa Rica - TechPoint Solutions","document_number":"TECH-COMP-001","days_ago":5,"category":"Cloud","description":"Servicios cloud mensuales de proyectos cliente","subtotal":485000,"tax":0,"total":485000,"payment_method":"Tarjeta corporativa","status":"registrada","review_status":"approved","review_notes":"Factura internacional clasificada.","confidence":92.75,"estado_contable":"borrador"},
              {"supplier_name":"Adobe LATAM - TechPoint Solutions","document_number":"TECH-COMP-002","days_ago":2,"category":"Licencias","description":"Licencias Creative Cloud equipo UX","subtotal":132000,"tax":0,"total":132000,"payment_method":"Tarjeta corporativa","status":"pendiente","review_status":"pending","review_notes":"Pendiente asignar proyecto interno.","confidence":86.25,"estado_contable":"pendiente"}
            ]'::jsonb
          end
        ) as item(
          supplier_name text,
          document_number text,
          days_ago int,
          category text,
          description text,
          subtotal numeric,
          tax numeric,
          total numeric,
          payment_method text,
          status text,
          review_status text,
          review_notes text,
          confidence numeric,
          estado_contable text
        )
        where not exists (
          select 1
          from public.purchases existing
          where existing.organization_id = org_record.id
            and existing.company_id = target_company_id
            and existing.document_number = item.document_number
        );
      end if;

      if to_regclass('public.invoices') is not null then
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
          review_status,
          review_notes,
          suggested_account,
          classification_confidence,
          estado_contable,
          notas
        )
        select
          org_record.id,
          target_company_id,
          seed_user_id,
          'factura',
          item.customer_name,
          item.document_number,
          current_date - (item.days_ago || ' days')::interval,
          'CRC',
          item.subtotal,
          item.tax,
          item.total,
          item.estado,
          item.review_status,
          item.review_notes,
          'D-400-VENTAS',
          item.confidence,
          item.estado_contable,
          'DEMO TRAINING - ' || company_record.industry
        from jsonb_to_recordset(
          case company_record.tax_id
            when '3-101-800001' then '[
              {"customer_name":"Festival Urbano CR - VAG Producciones","document_number":"VAG-FE-001","days_ago":10,"subtotal":1450000,"tax":188500,"total":1638500,"estado":"validada","review_status":"approved","review_notes":"Servicio de produccion completado.","confidence":95.30,"estado_contable":"contabilizado"},
              {"customer_name":"Agencia Bruma - VAG Producciones","document_number":"VAG-FE-002","days_ago":1,"subtotal":320000,"tax":41600,"total":361600,"estado":"revision","review_status":"pending","review_notes":"Pendiente aceptar orden de servicio.","confidence":84.20,"estado_contable":"pendiente"}
            ]'::jsonb
            when '3-101-800002' then '[
              {"customer_name":"Desarrollos Rio Norte - Constructora Nova CR","document_number":"NOVA-FE-001","days_ago":8,"subtotal":3200000,"tax":416000,"total":3616000,"estado":"validada","review_status":"approved","review_notes":"Avance de obra certificado.","confidence":97.00,"estado_contable":"borrador"},
              {"customer_name":"Condominio La Ribera - Constructora Nova CR","document_number":"NOVA-FE-002","days_ago":4,"subtotal":780000,"tax":101400,"total":881400,"estado":"revision","review_status":"observed","review_notes":"Revisar retencion contractual.","confidence":79.90,"estado_contable":"pendiente"}
            ]'::jsonb
            when '3-102-800003' then '[
              {"customer_name":"Hotel Bosque Alto - Cafe Montana Verde","document_number":"CAFE-FE-001","days_ago":6,"subtotal":380000,"tax":49400,"total":429400,"estado":"validada","review_status":"approved","review_notes":"Servicio coffee break empresarial.","confidence":96.80,"estado_contable":"contabilizado"},
              {"customer_name":"POS Restaurante - Cafe Montana Verde","document_number":"CAFE-FE-002","days_ago":1,"subtotal":290000,"tax":37700,"total":327700,"estado":"revision","review_status":"reviewed","review_notes":"Venta diaria consolidada POS.","confidence":90.00,"estado_contable":"pendiente"}
            ]'::jsonb
            else '[
              {"customer_name":"Fintech Prisma - TechPoint Solutions","document_number":"TECH-FE-001","days_ago":12,"subtotal":1850000,"tax":240500,"total":2090500,"estado":"validada","review_status":"approved","review_notes":"Consultoria sprint integracion APIs.","confidence":95.75,"estado_contable":"contabilizado"},
              {"customer_name":"Grupo Delta Digital - TechPoint Solutions","document_number":"TECH-FE-002","days_ago":2,"subtotal":640000,"tax":83200,"total":723200,"estado":"revision","review_status":"pending","review_notes":"Pendiente acta de aceptacion.","confidence":87.60,"estado_contable":"pendiente"}
            ]'::jsonb
          end
        ) as item(
          customer_name text,
          document_number text,
          days_ago int,
          subtotal numeric,
          tax numeric,
          total numeric,
          estado text,
          review_status text,
          review_notes text,
          confidence numeric,
          estado_contable text
        )
        where not exists (
          select 1
          from public.invoices existing
          where existing.organization_id = org_record.id
            and existing.company_id = target_company_id
            and existing.numero_documento = item.document_number
        );
      end if;

      if to_regclass('public.accounting_accounts') is not null then
        for account_record in
          select *
          from jsonb_to_recordset(demo_accounts) as item(
            code text,
            name text,
            type text,
            normal_balance text
          )
        loop
          insert into public.accounting_accounts (
            organization_id,
            company_id,
            code,
            name,
            type,
            normal_balance,
            is_system,
            is_active
          )
          values (
            org_record.id,
            target_company_id,
            account_record.code,
            account_record.name,
            account_record.type,
            account_record.normal_balance,
            true,
            true
          )
          on conflict (organization_id, company_id, code) do update set
            name = excluded.name,
            type = excluded.type,
            normal_balance = excluded.normal_balance,
            is_system = true,
            is_active = true;
        end loop;

        select id into debit_account_id
        from public.accounting_accounts
        where organization_id = org_record.id
          and company_id = target_company_id
          and code = 'D-500-GASTOS';

        select id into credit_account_id
        from public.accounting_accounts
        where organization_id = org_record.id
          and company_id = target_company_id
          and code = 'D-200-PAGAR';

        select id into iva_credit_account_id
        from public.accounting_accounts
        where organization_id = org_record.id
          and company_id = target_company_id
          and code = 'D-120-IVA-CRED';

        if to_regclass('public.journal_entries') is not null
          and to_regclass('public.journal_entry_lines') is not null then
          for purchase_id in
            select id
            from public.purchases
            where organization_id = org_record.id
              and company_id = target_company_id
              and document_number = case company_record.tax_id
                when '3-101-800001' then 'VAG-COMP-001'
                when '3-101-800002' then 'NOVA-COMP-001'
                when '3-102-800003' then 'CAFE-COMP-001'
                else 'TECH-COMP-001'
              end
            limit 1
          loop
            insert into public.journal_entries (
              organization_id,
              company_id,
              period_year,
              period_month,
              source_type,
              source_id,
              status,
              explanation,
              approved_at,
              approved_by
            )
            values (
              org_record.id,
              target_company_id,
              extract(year from current_date)::int,
              extract(month from current_date)::int,
              'purchase',
              purchase_id,
              'posted',
              'DEMO TRAINING - asiento automatico de compra por empresa.',
              now(),
              seed_user_id
            )
            on conflict (organization_id, company_id, source_type, source_id) do update set
              status = excluded.status,
              explanation = excluded.explanation,
              approved_at = excluded.approved_at,
              approved_by = excluded.approved_by
            returning id into entry_id;

            delete from public.journal_entry_lines
            where journal_entry_id = entry_id;

            insert into public.journal_entry_lines (
              journal_entry_id,
              account_id,
              side,
              amount,
              description
            )
            values
              (entry_id, debit_account_id, 'debit', 100000, 'Gasto operativo demo'),
              (entry_id, iva_credit_account_id, 'debit', 13000, 'IVA credito fiscal demo'),
              (entry_id, credit_account_id, 'credit', 113000, 'Cuenta por pagar demo');
          end loop;
        end if;
      end if;

      if to_regclass('public.cuentas_contables') is not null then
        for account_record in
          select *
          from jsonb_to_recordset('[
            {"codigo":"DM-101","nombre":"Banco demo manual","categoria":"activo","naturaleza":"deudora","tipo_estado":"BG"},
            {"codigo":"DM-201","nombre":"Cuentas por pagar demo manual","categoria":"pasivo","naturaleza":"acreedora","tipo_estado":"BG"},
            {"codigo":"DM-501","nombre":"Gasto operativo demo manual","categoria":"gasto","naturaleza":"deudora","tipo_estado":"ER"},
            {"codigo":"DM-401","nombre":"Ingreso demo manual","categoria":"ingreso","naturaleza":"acreedora","tipo_estado":"ER"}
          ]'::jsonb) as item(
            codigo text,
            nombre text,
            categoria text,
            naturaleza text,
            tipo_estado text
          )
        loop
          if exists (
            select 1
            from public.cuentas_contables
            where organization_id = org_record.id
              and codigo = account_record.codigo
          ) then
            update public.cuentas_contables
            set
              nombre = account_record.nombre,
              nivel = 1,
              tipo_estado = account_record.tipo_estado,
              categoria = account_record.categoria,
              naturaleza = account_record.naturaleza,
              tipo_cuenta = 'detalle',
              permite_movimientos = true,
              activa = true,
              metadata = jsonb_build_object('seed', 'demo_training_multiempresa'),
              updated_at = now()
            where organization_id = org_record.id
              and codigo = account_record.codigo;
          else
            insert into public.cuentas_contables (
              organization_id,
              codigo,
              nombre,
              nivel,
              tipo_estado,
              categoria,
              naturaleza,
              tipo_cuenta,
              permite_movimientos,
              activa,
              metadata
            )
            values (
              org_record.id,
              account_record.codigo,
              account_record.nombre,
              1,
              account_record.tipo_estado,
              account_record.categoria,
              account_record.naturaleza,
              'detalle',
              true,
              true,
              jsonb_build_object('seed', 'demo_training_multiempresa')
            );
          end if;
        end loop;

        if to_regclass('public.asientos_contables') is not null
          and to_regclass('public.asiento_lineas') is not null then
          if not exists (
            select 1
            from public.asientos_contables
            where organization_id = org_record.id
              and referencia = 'DEMO-' || company_record.tax_id || '-MANUAL-001'
          ) then
            insert into public.asientos_contables (
              organization_id,
              fecha,
              periodo,
              descripcion,
              referencia,
              modulo_origen,
              estado,
              moneda,
              creado_por,
              metadata
            )
            values (
              org_record.id,
              current_date - interval '2 days',
              to_char(current_date, 'YYYY-MM'),
              'DEMO TRAINING - ajuste manual ' || company_record.name,
              'DEMO-' || company_record.tax_id || '-MANUAL-001',
              'manual',
              'borrador',
              'CRC',
              seed_user_id,
              jsonb_build_object(
                'seed', 'demo_training_multiempresa',
                'company_id', target_company_id,
                'company_name', company_record.name,
                'template_ready', true
              )
            )
            returning id into manual_asiento_id;

            select id into debit_account_id
            from public.cuentas_contables
            where organization_id = org_record.id
              and codigo = 'DM-501';

            select id into accounts_payable_id
            from public.cuentas_contables
            where organization_id = org_record.id
              and codigo = 'DM-201';

            insert into public.asiento_lineas (
              asiento_id,
              organization_id,
              cuenta_contable_id,
              descripcion,
              debito,
              credito,
              moneda,
              metadata
            )
            values
              (
                manual_asiento_id,
                org_record.id,
                debit_account_id,
                'Gasto operativo demo ' || company_record.name,
                125000,
                0,
                'CRC',
                jsonb_build_object('company_id', target_company_id)
              ),
              (
                manual_asiento_id,
                org_record.id,
                accounts_payable_id,
                'Contrapartida demo ' || company_record.name,
                0,
                125000,
                'CRC',
                jsonb_build_object('company_id', target_company_id)
              );

            update public.asientos_contables
            set
              estado = 'contabilizado',
              contabilizado_at = now(),
              contabilizado_por = seed_user_id
            where id = manual_asiento_id;
          end if;
        end if;
      end if;
    end loop;

    if first_demo_company_id is not null then
      insert into public.profiles (
        id,
        active_organization_id,
        active_company_id
      )
      values (
        seed_user_id,
        org_record.id,
        first_demo_company_id
      )
      on conflict (id) do update set
        active_organization_id = excluded.active_organization_id,
        active_company_id = coalesce(public.profiles.active_company_id, excluded.active_company_id),
        updated_at = now();
    end if;
  end loop;
end;
$$;
