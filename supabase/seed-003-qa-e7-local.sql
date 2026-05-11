-- OM7 Finance OS - QA local E7 Mind seed
-- SOLO LOCAL / DEMO. No ejecutar en produccion.
--
-- Usuario demo:
--   email: qa.e7@om7.local
--   password: OM7Demo2026!
--
-- Este seed crea un flujo controlado:
-- organizacion -> empresa -> documento -> extraccion -> contraparte ->
-- clasificacion -> distribucion E7.
--
-- Para reiniciar la prueba, vuelve a ejecutar este archivo. El documento demo
-- vuelve a quedar sin convertir y se limpian compras/facturas generadas desde el.

do $$
declare
  qa_user_id uuid := '00000000-0000-4000-8000-000000000700';
  qa_org_id uuid := '00000000-0000-4000-8000-000000000701';
  qa_company_id uuid := '00000000-0000-4000-8000-000000000702';
  qa_document_id uuid := '00000000-0000-4000-8000-000000000703';
  qa_extraction_id uuid := '00000000-0000-4000-8000-000000000704';
  qa_classification_id uuid := '00000000-0000-4000-8000-000000000705';
  qa_counterparty_id uuid := '00000000-0000-4000-8000-000000000706';
  qa_match_id uuid := '00000000-0000-4000-8000-000000000707';
  qa_email text := 'qa.e7@om7.local';
  has_document_review_status boolean;
  has_document_notes boolean;
  has_document_converted_columns boolean;
  has_document_updated_columns boolean;
  has_invoice_source_document boolean;
  has_purchase_source_document boolean;
  has_auth_is_sso_user boolean;
  has_auth_is_anonymous boolean;
begin
  if qa_user_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Reemplaza qa_user_id con el UUID real del usuario qa.e7@om7.local creado en Supabase Auth.';
  end if;

  if to_regclass('public.document_accounting_distributions') is null then
    raise exception 'Falta schema-024-e7-mind-distributions.sql.';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'users'
      and column_name = 'is_sso_user'
  )
  into has_auth_is_sso_user;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'users'
      and column_name = 'is_anonymous'
  )
  into has_auth_is_anonymous;

  update auth.users
  set
    instance_id = '00000000-0000-0000-0000-000000000000',
    aud = 'authenticated',
    role = 'authenticated',
    email = qa_email,
    encrypted_password = crypt('OM7Demo2026!', gen_salt('bf')),
    email_confirmed_at = now(),
    confirmation_token = '',
    recovery_token = '',
    email_change_token_new = '',
    email_change_token_current = '',
    email_change = '',
    email_change_confirm_status = 0,
    banned_until = null,
    raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
    raw_user_meta_data = '{"full_name":"QA E7 Demo"}'::jsonb,
    updated_at = now()
  where id = qa_user_id;

  if not found then
    raise exception 'No existe el usuario Auth %. Crealo primero en Supabase Auth con UID %.', qa_email, qa_user_id;
  end if;

  if has_auth_is_sso_user then
    update auth.users
    set is_sso_user = false
    where id = qa_user_id;
  end if;

  if has_auth_is_anonymous then
    update auth.users
    set is_anonymous = false
    where id = qa_user_id;
  end if;

  delete from auth.identities
  where provider = 'email'
    and (
      user_id = qa_user_id
      or provider_id in (qa_email, qa_user_id::text)
    );

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    gen_random_uuid(),
    qa_user_id,
    jsonb_build_object(
      'sub',
      qa_user_id::text,
      'email',
      qa_email,
      'email_verified',
      true,
      'phone_verified',
      false
    ),
    'email',
    qa_email,
    now(),
    now(),
    now()
  );

  insert into public.organizations (
    id,
    name,
    account_type,
    country,
    base_currency,
    owner_id
  )
  values (
    qa_org_id,
    'OM7 QA Local',
    'accounting_firm',
    'Costa Rica',
    'CRC',
    qa_user_id
  )
  on conflict (id) do update set
    name = excluded.name,
    account_type = excluded.account_type,
    country = excluded.country,
    base_currency = excluded.base_currency,
    owner_id = excluded.owner_id,
    updated_at = now();

  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    status
  )
  values (
    qa_org_id,
    qa_user_id,
    'admin',
    'active'
  )
  on conflict (organization_id, user_id) do update set
    role = excluded.role,
    status = excluded.status;

  insert into public.companies (
    id,
    organization_id,
    name,
    legal_name,
    tax_id,
    country,
    base_currency,
    status
  )
  values (
    qa_company_id,
    qa_org_id,
    'Cafetal Aurora QA',
    'Cafetal Aurora QA Sociedad Anonima',
    '3101987654',
    'Costa Rica',
    'CRC',
    'active'
  )
  on conflict (id) do update set
    name = excluded.name,
    legal_name = excluded.legal_name,
    tax_id = excluded.tax_id,
    country = excluded.country,
    base_currency = excluded.base_currency,
    status = excluded.status,
    updated_at = now();

  insert into public.company_users (
    company_id,
    user_id,
    role,
    status
  )
  values (
    qa_company_id,
    qa_user_id,
    'admin',
    'active'
  )
  on conflict (company_id, user_id) do update set
    role = excluded.role,
    status = excluded.status;

  insert into public.profiles (
    id,
    full_name,
    email,
    active_organization_id,
    active_company_id
  )
  values (
    qa_user_id,
    'QA E7 Demo',
    qa_email,
    qa_org_id,
    qa_company_id
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    active_organization_id = excluded.active_organization_id,
    active_company_id = excluded.active_company_id,
    updated_at = now();

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'documents'
      and column_name = 'review_status'
  )
  into has_document_review_status;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'documents'
      and column_name = 'notes'
  )
  into has_document_notes;

  select count(*) = 5
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'documents'
    and column_name in (
      'converted_at',
      'converted_type',
      'converted_record_id',
      'converted_by',
      'conversion_notes'
  )
  into has_document_converted_columns;

  select count(*) = 2
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'documents'
    and column_name in ('updated_at', 'updated_by')
  into has_document_updated_columns;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'invoices'
      and column_name = 'source_document_id'
  )
  into has_invoice_source_document;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'purchases'
      and column_name = 'source_document_id'
  )
  into has_purchase_source_document;

  if to_regclass('public.invoice_collections') is not null
    and has_invoice_source_document
  then
    delete from public.invoice_collections
    where invoice_id in (
      select id from public.invoices where source_document_id = qa_document_id
    );
  end if;

  if to_regclass('public.purchase_payments') is not null
    and has_purchase_source_document
  then
    delete from public.purchase_payments
    where purchase_id in (
      select id from public.purchases where source_document_id = qa_document_id
    );
  end if;

  if to_regclass('public.journal_entry_lines') is not null
    and to_regclass('public.journal_entries') is not null
    and has_invoice_source_document
    and has_purchase_source_document
  then
    delete from public.journal_entry_lines
    where journal_entry_id in (
      select id from public.journal_entries where source_id in (
        select id from public.invoices where source_document_id = qa_document_id
        union
        select id from public.purchases where source_document_id = qa_document_id
      )
    );
  end if;

  if to_regclass('public.journal_entries') is not null
    and has_invoice_source_document
    and has_purchase_source_document
  then
    delete from public.journal_entries
    where source_id in (
      select id from public.invoices where source_document_id = qa_document_id
      union
      select id from public.purchases where source_document_id = qa_document_id
    );
  end if;

  if to_regclass('public.invoices') is not null
    and has_invoice_source_document
  then
    delete from public.invoices where source_document_id = qa_document_id;
  end if;

  if to_regclass('public.purchases') is not null
    and has_purchase_source_document
  then
    delete from public.purchases where source_document_id = qa_document_id;
  end if;

  insert into public.counterparties (
    id,
    organization_id,
    company_id,
    type,
    name,
    normalized_name,
    tax_id,
    normalized_tax_id,
    source,
    default_category,
    default_account,
    is_active
  )
  values (
    qa_counterparty_id,
    qa_org_id,
    qa_company_id,
    'customer',
    'Cliente Demo E7',
    'CLIENTE DEMO E7',
    '3101555001',
    '3101555001',
    'document',
    'Ingresos',
    '4-01 Ventas / Ingresos',
    true
  )
  on conflict (id) do update set
    type = excluded.type,
    name = excluded.name,
    normalized_name = excluded.normalized_name,
    tax_id = excluded.tax_id,
    normalized_tax_id = excluded.normalized_tax_id,
    source = excluded.source,
    default_category = excluded.default_category,
    default_account = excluded.default_account,
    is_active = excluded.is_active,
    updated_at = now();

  insert into public.documents (
    id,
    organization_id,
    company_id,
    user_id,
    related_type,
    related_id,
    original_filename,
    storage_path,
    mime_type,
    size_bytes,
    document_type,
    processing_status,
    metadata
  )
  values (
    qa_document_id,
    qa_org_id,
    qa_company_id,
    qa_user_id,
    'general',
    null,
    'qa-e7-factura-demo.xml',
    'organizations/' || qa_org_id || '/companies/' || qa_company_id || '/documents/qa-e7-factura-demo.xml',
    'application/xml',
    2048,
    'factura',
    'processed',
    '{"qa_seed":"e7_local","purpose":"e2e"}'::jsonb
  )
  on conflict (id) do update set
    related_type = excluded.related_type,
    original_filename = excluded.original_filename,
    storage_path = excluded.storage_path,
    mime_type = excluded.mime_type,
    size_bytes = excluded.size_bytes,
    document_type = excluded.document_type,
    processing_status = excluded.processing_status,
    metadata = excluded.metadata;

  if has_document_review_status then
    update public.documents
    set review_status = 'reviewed'
    where id = qa_document_id;
  end if;

  if has_document_notes then
    update public.documents
    set notes = 'Documento demo local para validar Documento -> E7 Mind -> Factura.'
    where id = qa_document_id;
  end if;

  if has_document_converted_columns then
    update public.documents
    set
      converted_at = null,
      converted_type = null,
      converted_record_id = null,
      converted_by = null,
      conversion_notes = null
    where id = qa_document_id;
  end if;

  if has_document_updated_columns then
    update public.documents
    set
      updated_at = now(),
      updated_by = qa_user_id
    where id = qa_document_id;
  end if;

  insert into public.document_extractions (
    id,
    organization_id,
    company_id,
    document_id,
    user_id,
    extraction_provider,
    extraction_status,
    raw_text,
    extracted_data,
    confidence,
    error_message,
    processed_at
  )
  values (
    qa_extraction_id,
    qa_org_id,
    qa_company_id,
    qa_document_id,
    qa_user_id,
    'xml-parser-cr',
    'reviewed',
    'Factura electronica QA E7 Demo. Emisor Cafetal Aurora QA. Receptor Cliente Demo E7.',
    jsonb_build_object(
      'document_kind', 'factura',
      'clave', '50611052600310198765400100001010000000001123456789',
      'numero_consecutivo', '00100001010000000001',
      'fecha_emision', current_date::text,
      'emisor_nombre', 'Cafetal Aurora QA Sociedad Anonima',
      'emisor_cedula', '3101987654',
      'receptor_nombre', 'Cliente Demo E7',
      'receptor_cedula', '3101555001',
      'moneda', 'CRC',
      'subtotal', 350000,
      'impuesto', 45500,
      'total', 395500,
      'medio_pago', 'Transferencia',
      'line_items', jsonb_build_array(
        jsonb_build_object(
          'detalle', 'Servicio profesional mensual',
          'cantidad', 1,
          'precio_unitario', 200000,
          'subtotal', 200000,
          'impuesto', 26000,
          'total_linea', 226000
        ),
        jsonb_build_object(
          'detalle', 'Implementacion y soporte operativo',
          'cantidad', 1,
          'precio_unitario', 150000,
          'subtotal', 150000,
          'impuesto', 19500,
          'total_linea', 169500
        )
      )
    ),
    0.97,
    null,
    now()
  )
  on conflict (id) do update set
    extraction_provider = excluded.extraction_provider,
    extraction_status = excluded.extraction_status,
    raw_text = excluded.raw_text,
    extracted_data = excluded.extracted_data,
    confidence = excluded.confidence,
    error_message = excluded.error_message,
    processed_at = excluded.processed_at,
    updated_at = now();

  insert into public.document_classifications (
    id,
    organization_id,
    company_id,
    document_id,
    extraction_id,
    flow_type,
    counterparty_type,
    suggested_account,
    suggested_category,
    suggested_cost_center_id,
    confidence_score,
    rule_applied,
    explanation,
    needs_review,
    status,
    reviewed_by,
    reviewed_at
  )
  values (
    qa_classification_id,
    qa_org_id,
    qa_company_id,
    qa_document_id,
    qa_extraction_id,
    'sale',
    'customer',
    '4-01 Ventas / Ingresos',
    'Ingresos',
    null,
    0.94,
    'qa_e7_seed_sale',
    'Factura emitida por la empresa demo a cliente demo.',
    false,
    'accepted',
    qa_user_id,
    now()
  )
  on conflict (extraction_id) do update set
    flow_type = excluded.flow_type,
    counterparty_type = excluded.counterparty_type,
    suggested_account = excluded.suggested_account,
    suggested_category = excluded.suggested_category,
    suggested_cost_center_id = excluded.suggested_cost_center_id,
    confidence_score = excluded.confidence_score,
    rule_applied = excluded.rule_applied,
    explanation = excluded.explanation,
    needs_review = excluded.needs_review,
    status = excluded.status,
    reviewed_by = excluded.reviewed_by,
    reviewed_at = excluded.reviewed_at,
    updated_at = now();

  insert into public.document_counterparty_matches (
    id,
    organization_id,
    company_id,
    document_id,
    extraction_id,
    classification_id,
    counterparty_id,
    match_status,
    counterparty_type,
    name,
    tax_id,
    confidence_score,
    explanation,
    status,
    reviewed_by,
    reviewed_at
  )
  values (
    qa_match_id,
    qa_org_id,
    qa_company_id,
    qa_document_id,
    qa_extraction_id,
    qa_classification_id,
    qa_counterparty_id,
    'exact',
    'customer',
    'Cliente Demo E7',
    '3101555001',
    0.99,
    'Coincidencia exacta del seed QA local.',
    'accepted',
    qa_user_id,
    now()
  )
  on conflict (extraction_id) do update set
    classification_id = excluded.classification_id,
    counterparty_id = excluded.counterparty_id,
    match_status = excluded.match_status,
    counterparty_type = excluded.counterparty_type,
    name = excluded.name,
    tax_id = excluded.tax_id,
    confidence_score = excluded.confidence_score,
    explanation = excluded.explanation,
    status = excluded.status,
    reviewed_by = excluded.reviewed_by,
    reviewed_at = excluded.reviewed_at,
    updated_at = now();

  delete from public.document_accounting_distributions
  where extraction_id = qa_extraction_id;

  insert into public.document_accounting_distributions (
    id,
    organization_id,
    company_id,
    document_id,
    extraction_id,
    classification_id,
    line_index,
    line_description,
    quantity,
    subtotal,
    tax,
    total,
    suggested_account,
    final_account,
    suggested_category,
    final_category,
    suggested_cost_center,
    final_cost_center,
    tax_treatment,
    confidence_score,
    rule_applied,
    status,
    corrected_by,
    metadata
  )
  values
    (
      '00000000-0000-4000-8000-000000000710',
      qa_org_id,
      qa_company_id,
      qa_document_id,
      qa_extraction_id,
      qa_classification_id,
      0,
      'Servicio profesional mensual',
      1,
      200000,
      26000,
      226000,
      '4-01 Ventas / Ingresos',
      '4-01 Ventas / Ingresos',
      'Ingresos',
      'Ingresos',
      'Administracion',
      'Administracion',
      'iva_debito_fiscal',
      0.94,
      'qa_e7_seed_line_service',
      'suggested',
      null,
      '{"qa_seed":"e7_local"}'::jsonb
    ),
    (
      '00000000-0000-4000-8000-000000000711',
      qa_org_id,
      qa_company_id,
      qa_document_id,
      qa_extraction_id,
      qa_classification_id,
      1,
      'Implementacion y soporte operativo',
      1,
      150000,
      19500,
      169500,
      '4-01 Ventas / Ingresos',
      '4-01 Ventas / Ingresos',
      'Ingresos',
      'Ingresos',
      'Operacion',
      'Operacion',
      'iva_debito_fiscal',
      0.88,
      'qa_e7_seed_line_support',
      'suggested',
      null,
      '{"qa_seed":"e7_local"}'::jsonb
    );

  raise notice 'QA E7 local listo. Login: % / OM7Demo2026!. Documento: %', qa_email, qa_document_id;
end;
$$;
