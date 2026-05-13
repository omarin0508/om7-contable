create table if not exists public.subcontratos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  nombre text not null,
  subcontratista_nombre text not null,
  counterparty_id uuid,
  tipo_subcontrato text not null default 'obra',
  categoria_subcontrato text,
  fecha_inicio date,
  fecha_fin date,
  moneda text not null default 'CRC',
  monto_total numeric not null default 0,
  monto_retencion_estimado numeric not null default 0,
  monto_pagado numeric not null default 0,
  centro_costo_id uuid,
  presupuesto_id uuid,
  estado_operativo text not null default 'borrador',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subcontratos
drop constraint if exists subcontratos_nombre_not_blank;

alter table public.subcontratos
add constraint subcontratos_nombre_not_blank
check (length(btrim(nombre)) > 0);

alter table public.subcontratos
drop constraint if exists subcontratos_subcontratista_not_blank;

alter table public.subcontratos
add constraint subcontratos_subcontratista_not_blank
check (length(btrim(subcontratista_nombre)) > 0);

alter table public.subcontratos
drop constraint if exists subcontratos_montos_check;

alter table public.subcontratos
add constraint subcontratos_montos_check
check (
  monto_total >= 0
  and monto_retencion_estimado >= 0
  and monto_pagado >= 0
);

alter table public.subcontratos
drop constraint if exists subcontratos_estado_operativo_check;

alter table public.subcontratos
add constraint subcontratos_estado_operativo_check
check (estado_operativo in ('borrador', 'revisado', 'aprobado', 'en_ejecucion', 'cerrado', 'anulado'));

create index if not exists subcontratos_company_idx
on public.subcontratos (organization_id, company_id);

create index if not exists subcontratos_estado_idx
on public.subcontratos (organization_id, estado_operativo);

create table if not exists public.subcontratos_hitos (
  id uuid primary key default gen_random_uuid(),
  subcontrato_id uuid not null references public.subcontratos(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nombre text not null,
  descripcion text,
  fecha_programada date,
  monto_estimado numeric not null default 0,
  estado text not null default 'pendiente',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subcontratos_hitos
drop constraint if exists subcontratos_hitos_nombre_not_blank;

alter table public.subcontratos_hitos
add constraint subcontratos_hitos_nombre_not_blank
check (length(btrim(nombre)) > 0);

alter table public.subcontratos_hitos
drop constraint if exists subcontratos_hitos_monto_check;

alter table public.subcontratos_hitos
add constraint subcontratos_hitos_monto_check
check (monto_estimado >= 0);

alter table public.subcontratos_hitos
drop constraint if exists subcontratos_hitos_estado_check;

alter table public.subcontratos_hitos
add constraint subcontratos_hitos_estado_check
check (estado in ('pendiente', 'aprobado', 'pagado', 'anulado'));

create index if not exists subcontratos_hitos_subcontrato_idx
on public.subcontratos_hitos (subcontrato_id);

create table if not exists public.subcontratos_pagos (
  id uuid primary key default gen_random_uuid(),
  subcontrato_id uuid not null references public.subcontratos(id) on delete cascade,
  hito_id uuid references public.subcontratos_hitos(id) on delete set null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  payment_method_id uuid references public.payment_methods(id) on delete restrict,
  numero_documento text,
  fecha_pago date not null,
  monto_bruto numeric not null,
  monto_retencion numeric not null default 0,
  monto_neto numeric not null default 0,
  estado_operativo text not null default 'aprobado',
  asiento_contable_id uuid references public.asientos_contables(id) on delete set null,
  estado_contable text not null default 'pendiente',
  contabilizacion_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subcontratos_pagos
drop constraint if exists subcontratos_pagos_montos_check;

alter table public.subcontratos_pagos
add constraint subcontratos_pagos_montos_check
check (
  monto_bruto > 0
  and monto_retencion >= 0
  and monto_neto >= 0
  and monto_retencion <= monto_bruto
);

alter table public.subcontratos_pagos
drop constraint if exists subcontratos_pagos_estado_operativo_check;

alter table public.subcontratos_pagos
add constraint subcontratos_pagos_estado_operativo_check
check (estado_operativo in ('borrador', 'revisado', 'aprobado', 'pagado', 'anulado'));

alter table public.subcontratos_pagos
drop constraint if exists subcontratos_pagos_estado_contable_check;

alter table public.subcontratos_pagos
add constraint subcontratos_pagos_estado_contable_check
check (estado_contable in ('pendiente', 'borrador', 'contabilizado', 'anulado', 'error'));

create index if not exists subcontratos_pagos_subcontrato_idx
on public.subcontratos_pagos (subcontrato_id);

create index if not exists subcontratos_pagos_company_date_idx
on public.subcontratos_pagos (organization_id, company_id, fecha_pago);

create index if not exists subcontratos_pagos_estado_contable_idx
on public.subcontratos_pagos (organization_id, estado_contable);

create index if not exists subcontratos_pagos_asiento_contable_idx
on public.subcontratos_pagos (asiento_contable_id);

create table if not exists public.reglas_contables_subcontratos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  tipo_subcontrato text not null,
  categoria_subcontrato text,
  cuenta_costo_subcontrato_id uuid not null references public.cuentas_contables(id) on delete restrict,
  cuenta_proveedor_id uuid not null references public.cuentas_contables(id) on delete restrict,
  cuenta_banco_id uuid references public.cuentas_contables(id) on delete restrict,
  cuenta_retenciones_id uuid references public.cuentas_contables(id) on delete restrict,
  requiere_centro_costo boolean not null default true,
  prioridad integer not null default 100,
  activa boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reglas_contables_subcontratos
drop constraint if exists reglas_contables_subcontratos_tipo_not_blank;

alter table public.reglas_contables_subcontratos
add constraint reglas_contables_subcontratos_tipo_not_blank
check (length(btrim(tipo_subcontrato)) > 0);

create index if not exists reglas_contables_subcontratos_organization_idx
on public.reglas_contables_subcontratos (organization_id);

create index if not exists reglas_contables_subcontratos_tipo_categoria_idx
on public.reglas_contables_subcontratos (
  lower(btrim(tipo_subcontrato)),
  lower(btrim(coalesce(categoria_subcontrato, '')))
);

create index if not exists reglas_contables_subcontratos_activa_prioridad_idx
on public.reglas_contables_subcontratos (activa, prioridad);

create unique index if not exists reglas_contables_subcontratos_global_tipo_categoria_key
on public.reglas_contables_subcontratos (
  lower(btrim(tipo_subcontrato)),
  lower(btrim(coalesce(categoria_subcontrato, '')))
)
where organization_id is null;

create unique index if not exists reglas_contables_subcontratos_org_tipo_categoria_key
on public.reglas_contables_subcontratos (
  organization_id,
  lower(btrim(tipo_subcontrato)),
  lower(btrim(coalesce(categoria_subcontrato, '')))
)
where organization_id is not null;

create or replace function public.recalcular_totales_subcontrato(p_subcontrato_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.subcontratos subcontrato
  set
    monto_pagado = coalesce(totals.monto_pagado, 0),
    updated_at = now()
  from (
    select coalesce(sum(monto_bruto), 0) as monto_pagado
    from public.subcontratos_pagos
    where subcontrato_id = p_subcontrato_id
      and estado_operativo <> 'anulado'
      and estado_contable <> 'anulado'
  ) totals
  where subcontrato.id = p_subcontrato_id;
end;
$$;

create or replace function public.sync_subcontrato_totales_from_pagos()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalcular_totales_subcontrato(old.subcontrato_id);
    return old;
  end if;

  perform public.recalcular_totales_subcontrato(new.subcontrato_id);

  if tg_op = 'UPDATE' and old.subcontrato_id <> new.subcontrato_id then
    perform public.recalcular_totales_subcontrato(old.subcontrato_id);
  end if;

  return new;
end;
$$;

create or replace function public.validate_subcontrato_pago()
returns trigger
language plpgsql
as $$
declare
  target_subcontrato public.subcontratos%rowtype;
begin
  select *
  into target_subcontrato
  from public.subcontratos
  where id = new.subcontrato_id;

  if target_subcontrato.id is null then
    raise exception 'El subcontrato no existe.';
  end if;

  if target_subcontrato.organization_id <> new.organization_id
    or target_subcontrato.company_id <> new.company_id
  then
    raise exception 'El pago debe pertenecer a la misma organizacion y empresa del subcontrato.';
  end if;

  if new.monto_neto = 0 then
    new.monto_neto := greatest(new.monto_bruto - new.monto_retencion, 0);
  end if;

  if new.monto_neto + new.monto_retencion <> new.monto_bruto then
    raise exception 'El monto neto mas retenciones debe coincidir con el monto bruto.';
  end if;

  if tg_op = 'UPDATE'
    and old.estado_contable = 'contabilizado'
    and (
      old.subcontrato_id is distinct from new.subcontrato_id
      or old.hito_id is distinct from new.hito_id
      or old.fecha_pago is distinct from new.fecha_pago
      or old.monto_bruto is distinct from new.monto_bruto
      or old.monto_retencion is distinct from new.monto_retencion
      or old.monto_neto is distinct from new.monto_neto
      or old.payment_method_id is distinct from new.payment_method_id
      or old.estado_operativo is distinct from new.estado_operativo
    )
  then
    raise exception 'El pago de subcontrato ya esta contabilizado. Reverti el asiento antes de modificarlo.';
  end if;

  return new;
end;
$$;

create or replace function public.obtener_regla_contable_subcontrato(
  p_organization_id uuid,
  p_tipo_subcontrato text,
  p_categoria_subcontrato text default null
)
returns table (
  id uuid,
  organization_id uuid,
  tipo_subcontrato text,
  categoria_subcontrato text,
  cuenta_costo_subcontrato_id uuid,
  cuenta_proveedor_id uuid,
  cuenta_banco_id uuid,
  cuenta_retenciones_id uuid,
  requiere_centro_costo boolean,
  prioridad integer,
  activa boolean,
  metadata jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    regla.id,
    regla.organization_id,
    regla.tipo_subcontrato,
    regla.categoria_subcontrato,
    regla.cuenta_costo_subcontrato_id,
    regla.cuenta_proveedor_id,
    regla.cuenta_banco_id,
    regla.cuenta_retenciones_id,
    regla.requiere_centro_costo,
    regla.prioridad,
    regla.activa,
    regla.metadata,
    regla.created_at,
    regla.updated_at
  from public.reglas_contables_subcontratos regla
  where regla.activa is true
    and lower(btrim(regla.tipo_subcontrato)) = lower(btrim(coalesce(p_tipo_subcontrato, 'obra')))
    and (
      lower(btrim(coalesce(regla.categoria_subcontrato, ''))) =
        lower(btrim(coalesce(p_categoria_subcontrato, '')))
      or regla.categoria_subcontrato is null
    )
    and (
      regla.organization_id = p_organization_id
      or regla.organization_id is null
    )
  order by
    case when regla.organization_id = p_organization_id then 0 else 1 end,
    case
      when lower(btrim(coalesce(regla.categoria_subcontrato, ''))) =
        lower(btrim(coalesce(p_categoria_subcontrato, ''))) then 0
      else 1
    end,
    regla.prioridad asc,
    regla.created_at asc
  limit 1;
$$;

create or replace function public.set_subcontract_accounting_error(
  p_pago_id uuid,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.subcontratos_pagos
  set
    estado_contable = 'error',
    contabilizacion_error = p_message,
    updated_at = now()
  where id = p_pago_id;
end;
$$;

create or replace function public.generar_asiento_subcontrato(p_subcontrato_pago_id uuid)
returns public.asientos_contables
language plpgsql
security definer
set search_path = public
as $$
declare
  target_pago public.subcontratos_pagos%rowtype;
  target_subcontrato public.subcontratos%rowtype;
  target_rule public.reglas_contables_subcontratos%rowtype;
  existing_asiento public.asientos_contables%rowtype;
  new_asiento public.asientos_contables%rowtype;
  gross_amount numeric;
  retention_amount numeric;
  net_amount numeric;
  payable_amount numeric;
  validation_message text;
  projected_total numeric;
begin
  select *
  into target_pago
  from public.subcontratos_pagos
  where id = p_subcontrato_pago_id
  for update;

  if target_pago.id is null then
    raise exception 'Pago de subcontrato no encontrado.';
  end if;

  if not public.is_internal_org_member(target_pago.organization_id)
    and coalesce(auth.role(), '') <> 'service_role'
  then
    raise exception 'No tienes permisos para contabilizar este subcontrato.';
  end if;

  select *
  into target_subcontrato
  from public.subcontratos
  where id = target_pago.subcontrato_id
  for update;

  if target_subcontrato.id is null then
    validation_message := 'El pago requiere un subcontrato valido.';
    perform public.set_subcontract_accounting_error(target_pago.id, validation_message);
    raise exception '%', validation_message;
  end if;

  if target_subcontrato.estado_operativo not in ('aprobado', 'en_ejecucion', 'cerrado') then
    validation_message := 'El subcontrato debe estar aprobado o en ejecucion.';
    perform public.set_subcontract_accounting_error(target_pago.id, validation_message);
    raise exception '%', validation_message;
  end if;

  if target_pago.estado_operativo not in ('revisado', 'aprobado', 'pagado') then
    validation_message := 'El pago debe estar revisado, aprobado o pagado antes de contabilizar.';
    perform public.set_subcontract_accounting_error(target_pago.id, validation_message);
    raise exception '%', validation_message;
  end if;

  gross_amount := greatest(coalesce(target_pago.monto_bruto, 0), 0);
  retention_amount := greatest(coalesce(target_pago.monto_retencion, 0), 0);
  net_amount := greatest(coalesce(target_pago.monto_neto, 0), 0);

  if net_amount <= 0 then
    net_amount := greatest(gross_amount - retention_amount, 0);
  end if;

  if gross_amount <= 0 then
    validation_message := 'El pago no tiene monto suficiente para contabilizar.';
    perform public.set_subcontract_accounting_error(target_pago.id, validation_message);
    raise exception '%', validation_message;
  end if;

  if abs((net_amount + retention_amount) - gross_amount) >= 0.01 then
    validation_message := 'El neto mas retenciones debe coincidir con el bruto del pago.';
    perform public.set_subcontract_accounting_error(target_pago.id, validation_message);
    raise exception '%', validation_message;
  end if;

  select coalesce(sum(monto_bruto), 0)
  into projected_total
  from public.subcontratos_pagos
  where subcontrato_id = target_pago.subcontrato_id
    and id <> target_pago.id
    and estado_operativo <> 'anulado'
    and estado_contable <> 'anulado';

  if target_subcontrato.monto_total > 0
    and projected_total + gross_amount > target_subcontrato.monto_total + 0.004
  then
    validation_message := 'El pago excede el monto total del subcontrato.';
    perform public.set_subcontract_accounting_error(target_pago.id, validation_message);
    raise exception '%', validation_message;
  end if;

  if target_pago.asiento_contable_id is not null then
    select *
    into existing_asiento
    from public.asientos_contables
    where id = target_pago.asiento_contable_id
    for update;

    if existing_asiento.id is not null and existing_asiento.estado = 'contabilizado' then
      update public.subcontratos_pagos
      set
        estado_contable = 'contabilizado',
        contabilizacion_error = null,
        updated_at = now()
      where id = target_pago.id;
      return existing_asiento;
    end if;

    if existing_asiento.id is not null and existing_asiento.estado = 'borrador' then
      delete from public.asientos_contables
      where id = existing_asiento.id;
    end if;
  end if;

  select *
  into target_rule
  from public.obtener_regla_contable_subcontrato(
    target_pago.organization_id,
    target_subcontrato.tipo_subcontrato,
    target_subcontrato.categoria_subcontrato
  );

  if target_rule.id is null then
    validation_message := 'No existe regla contable activa para este subcontrato.';
    perform public.set_subcontract_accounting_error(target_pago.id, validation_message);
    raise exception '%', validation_message;
  end if;

  payable_amount := net_amount;

  if target_pago.estado_operativo = 'pagado' then
    if net_amount > 0 and target_rule.cuenta_banco_id is null then
      validation_message := 'El pago esta pagado pero la regla no tiene cuenta banco/caja.';
      perform public.set_subcontract_accounting_error(target_pago.id, validation_message);
      raise exception '%', validation_message;
    end if;
  else
    payable_amount := net_amount;
  end if;

  if retention_amount > 0 and target_rule.cuenta_retenciones_id is null then
    validation_message := 'El pago tiene retenciones pero la regla no tiene cuenta de retenciones.';
    perform public.set_subcontract_accounting_error(target_pago.id, validation_message);
    raise exception '%', validation_message;
  end if;

  insert into public.asientos_contables (
    organization_id,
    fecha,
    periodo,
    descripcion,
    referencia,
    modulo_origen,
    estado,
    moneda,
    total_debito,
    total_credito,
    creado_por,
    metadata
  )
  values (
    target_pago.organization_id,
    target_pago.fecha_pago,
    to_char(target_pago.fecha_pago, 'YYYY-MM'),
    'Subcontrato ' || target_subcontrato.nombre,
    coalesce(target_pago.numero_documento, target_subcontrato.nombre),
    'subcontratos',
    'borrador',
    coalesce(target_subcontrato.moneda, 'CRC'),
    0,
    0,
    auth.uid(),
    jsonb_build_object(
      'source_type', 'subcontract_payment',
      'source_subcontrato_pago_id', target_pago.id,
      'source_subcontrato_id', target_subcontrato.id,
      'company_id', target_pago.company_id,
      'rule_id', target_rule.id
    )
  )
  returning *
  into new_asiento;

  insert into public.asiento_lineas (
    asiento_id,
    organization_id,
    cuenta_contable_id,
    descripcion,
    tercero_id,
    centro_costo_id,
    presupuesto_id,
    debito,
    credito,
    moneda,
    metadata
  )
  values (
    new_asiento.id,
    target_pago.organization_id,
    target_rule.cuenta_costo_subcontrato_id,
    'Costo subcontrato',
    target_subcontrato.counterparty_id,
    target_subcontrato.centro_costo_id,
    target_subcontrato.presupuesto_id,
    gross_amount,
    0,
    coalesce(target_subcontrato.moneda, 'CRC'),
    jsonb_build_object('subcontrato_pago_id', target_pago.id, 'line_type', 'costo')
  );

  if net_amount > 0 then
    insert into public.asiento_lineas (
      asiento_id,
      organization_id,
      cuenta_contable_id,
      descripcion,
      tercero_id,
      centro_costo_id,
      presupuesto_id,
      debito,
      credito,
      moneda,
      metadata
    )
    values (
      new_asiento.id,
      target_pago.organization_id,
      case
        when target_pago.estado_operativo = 'pagado' then target_rule.cuenta_banco_id
        else target_rule.cuenta_proveedor_id
      end,
      case
        when target_pago.estado_operativo = 'pagado' then 'Pago neto subcontrato'
        else 'Cuenta por pagar subcontratista'
      end,
      target_subcontrato.counterparty_id,
      target_subcontrato.centro_costo_id,
      target_subcontrato.presupuesto_id,
      0,
      payable_amount,
      coalesce(target_subcontrato.moneda, 'CRC'),
      jsonb_build_object('subcontrato_pago_id', target_pago.id, 'line_type', 'contrapartida')
    );
  end if;

  if retention_amount > 0 then
    insert into public.asiento_lineas (
      asiento_id,
      organization_id,
      cuenta_contable_id,
      descripcion,
      tercero_id,
      centro_costo_id,
      presupuesto_id,
      debito,
      credito,
      moneda,
      metadata
    )
    values (
      new_asiento.id,
      target_pago.organization_id,
      target_rule.cuenta_retenciones_id,
      'Retenciones por pagar subcontrato',
      target_subcontrato.counterparty_id,
      target_subcontrato.centro_costo_id,
      target_subcontrato.presupuesto_id,
      0,
      retention_amount,
      coalesce(target_subcontrato.moneda, 'CRC'),
      jsonb_build_object('subcontrato_pago_id', target_pago.id, 'line_type', 'retencion')
    );
  end if;

  perform public.recalcular_totales_asiento(new_asiento.id);

  select *
  into new_asiento
  from public.asientos_contables
  where id = new_asiento.id;

  update public.subcontratos_pagos
  set
    asiento_contable_id = new_asiento.id,
    estado_contable = 'borrador',
    contabilizacion_error = null,
    updated_at = now()
  where id = target_pago.id;

  perform public.recalcular_totales_subcontrato(target_subcontrato.id);

  return new_asiento;
end;
$$;

create or replace function public.revertir_asiento_subcontrato(
  p_subcontrato_pago_id uuid,
  p_motivo text default 'Reversion contable de subcontrato'
)
returns public.asientos_contables
language plpgsql
security definer
set search_path = public
as $$
declare
  target_pago public.subcontratos_pagos%rowtype;
  target_asiento public.asientos_contables%rowtype;
begin
  select *
  into target_pago
  from public.subcontratos_pagos
  where id = p_subcontrato_pago_id
  for update;

  if target_pago.id is null then
    raise exception 'Pago de subcontrato no encontrado.';
  end if;

  if not public.is_internal_org_member(target_pago.organization_id)
    and coalesce(auth.role(), '') <> 'service_role'
  then
    raise exception 'No tienes permisos para revertir este subcontrato.';
  end if;

  if target_pago.asiento_contable_id is null then
    update public.subcontratos_pagos
    set estado_contable = 'pendiente', updated_at = now()
    where id = target_pago.id;
    raise exception 'El pago no tiene asiento contable asociado.';
  end if;

  select *
  into target_asiento
  from public.asientos_contables
  where id = target_pago.asiento_contable_id
  for update;

  if target_asiento.id is null then
    update public.subcontratos_pagos
    set
      asiento_contable_id = null,
      estado_contable = 'pendiente',
      updated_at = now()
    where id = target_pago.id;
    raise exception 'El asiento asociado no existe.';
  end if;

  if target_asiento.estado <> 'anulado' then
    update public.asientos_contables
    set
      estado = 'anulado',
      motivo_anulacion = coalesce(nullif(btrim(p_motivo), ''), 'Reversion contable de subcontrato'),
      anulado_at = now(),
      anulado_por = auth.uid(),
      updated_at = now()
    where id = target_asiento.id
    returning *
    into target_asiento;
  end if;

  update public.subcontratos_pagos
  set
    estado_contable = 'anulado',
    contabilizacion_error = null,
    updated_at = now()
  where id = target_pago.id;

  perform public.recalcular_totales_subcontrato(target_pago.subcontrato_id);

  return target_asiento;
end;
$$;

create or replace function public.sync_subcontract_accounting_status_from_asiento()
returns trigger
language plpgsql
as $$
declare
  pago_id uuid;
  next_status text;
begin
  if new.modulo_origen <> 'subcontratos' then
    return new;
  end if;

  pago_id := nullif(new.metadata ->> 'source_subcontrato_pago_id', '')::uuid;

  if pago_id is null then
    return new;
  end if;

  next_status := case
    when new.estado = 'contabilizado' then 'contabilizado'
    when new.estado = 'anulado' then 'anulado'
    else 'borrador'
  end;

  update public.subcontratos_pagos
  set
    asiento_contable_id = new.id,
    estado_contable = next_status,
    contabilizacion_error = null,
    updated_at = now()
  where id = pago_id;

  return new;
end;
$$;

create or replace function public.block_subcontract_with_posted_payments_changes()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.subcontratos_pagos pago
    where pago.subcontrato_id = old.id
      and pago.estado_contable = 'contabilizado'
  )
    and (
      old.organization_id is distinct from new.organization_id
      or old.company_id is distinct from new.company_id
      or old.nombre is distinct from new.nombre
      or old.subcontratista_nombre is distinct from new.subcontratista_nombre
      or old.counterparty_id is distinct from new.counterparty_id
      or old.tipo_subcontrato is distinct from new.tipo_subcontrato
      or old.categoria_subcontrato is distinct from new.categoria_subcontrato
      or old.moneda is distinct from new.moneda
      or old.monto_total is distinct from new.monto_total
      or old.monto_retencion_estimado is distinct from new.monto_retencion_estimado
      or old.centro_costo_id is distinct from new.centro_costo_id
      or old.presupuesto_id is distinct from new.presupuesto_id
      or old.estado_operativo is distinct from new.estado_operativo
    )
  then
    raise exception 'El subcontrato ya tiene pagos contabilizados. Reverti los asientos antes de modificarlo.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_subcontrato_pago_trigger
on public.subcontratos_pagos;
create trigger validate_subcontrato_pago_trigger
before insert or update
on public.subcontratos_pagos
for each row execute function public.validate_subcontrato_pago();

drop trigger if exists sync_subcontrato_totales_from_pagos_trigger
on public.subcontratos_pagos;
create trigger sync_subcontrato_totales_from_pagos_trigger
after insert or update or delete
on public.subcontratos_pagos
for each row execute function public.sync_subcontrato_totales_from_pagos();

drop trigger if exists sync_subcontract_accounting_status_from_asiento_trigger
on public.asientos_contables;
create trigger sync_subcontract_accounting_status_from_asiento_trigger
after insert or update of estado
on public.asientos_contables
for each row execute function public.sync_subcontract_accounting_status_from_asiento();

drop trigger if exists block_subcontract_with_posted_payments_changes_trigger
on public.subcontratos;
create trigger block_subcontract_with_posted_payments_changes_trigger
before update on public.subcontratos
for each row execute function public.block_subcontract_with_posted_payments_changes();

drop trigger if exists set_subcontratos_updated_at
on public.subcontratos;
create trigger set_subcontratos_updated_at
before update on public.subcontratos
for each row execute function public.set_updated_at();

drop trigger if exists set_subcontratos_hitos_updated_at
on public.subcontratos_hitos;
create trigger set_subcontratos_hitos_updated_at
before update on public.subcontratos_hitos
for each row execute function public.set_updated_at();

drop trigger if exists set_subcontratos_pagos_updated_at
on public.subcontratos_pagos;
create trigger set_subcontratos_pagos_updated_at
before update on public.subcontratos_pagos
for each row execute function public.set_updated_at();

drop trigger if exists set_reglas_contables_subcontratos_updated_at
on public.reglas_contables_subcontratos;
create trigger set_reglas_contables_subcontratos_updated_at
before update on public.reglas_contables_subcontratos
for each row execute function public.set_updated_at();

alter table public.subcontratos enable row level security;
alter table public.subcontratos_hitos enable row level security;
alter table public.subcontratos_pagos enable row level security;
alter table public.reglas_contables_subcontratos enable row level security;

drop policy if exists "subcontratos_select_internal" on public.subcontratos;
create policy "subcontratos_select_internal"
on public.subcontratos for select
to authenticated
using (public.is_internal_org_member(organization_id));

drop policy if exists "subcontratos_insert_internal" on public.subcontratos;
create policy "subcontratos_insert_internal"
on public.subcontratos for insert
to authenticated
with check (public.is_internal_org_member(organization_id));

drop policy if exists "subcontratos_update_internal" on public.subcontratos;
create policy "subcontratos_update_internal"
on public.subcontratos for update
to authenticated
using (public.is_internal_org_member(organization_id))
with check (public.is_internal_org_member(organization_id));

drop policy if exists "subcontratos_hitos_select_internal" on public.subcontratos_hitos;
create policy "subcontratos_hitos_select_internal"
on public.subcontratos_hitos for select
to authenticated
using (public.is_internal_org_member(organization_id));

drop policy if exists "subcontratos_hitos_insert_internal" on public.subcontratos_hitos;
create policy "subcontratos_hitos_insert_internal"
on public.subcontratos_hitos for insert
to authenticated
with check (public.is_internal_org_member(organization_id));

drop policy if exists "subcontratos_hitos_update_internal" on public.subcontratos_hitos;
create policy "subcontratos_hitos_update_internal"
on public.subcontratos_hitos for update
to authenticated
using (public.is_internal_org_member(organization_id))
with check (public.is_internal_org_member(organization_id));

drop policy if exists "subcontratos_pagos_select_internal" on public.subcontratos_pagos;
create policy "subcontratos_pagos_select_internal"
on public.subcontratos_pagos for select
to authenticated
using (public.is_internal_org_member(organization_id));

drop policy if exists "subcontratos_pagos_insert_internal" on public.subcontratos_pagos;
create policy "subcontratos_pagos_insert_internal"
on public.subcontratos_pagos for insert
to authenticated
with check (public.is_internal_org_member(organization_id));

drop policy if exists "subcontratos_pagos_update_internal" on public.subcontratos_pagos;
create policy "subcontratos_pagos_update_internal"
on public.subcontratos_pagos for update
to authenticated
using (public.is_internal_org_member(organization_id))
with check (public.is_internal_org_member(organization_id));

drop policy if exists "reglas_contables_subcontratos_select_internal"
on public.reglas_contables_subcontratos;
create policy "reglas_contables_subcontratos_select_internal"
on public.reglas_contables_subcontratos for select
to authenticated
using (
  organization_id is null
  or public.is_internal_org_member(organization_id)
);

drop policy if exists "reglas_contables_subcontratos_insert_internal"
on public.reglas_contables_subcontratos;
create policy "reglas_contables_subcontratos_insert_internal"
on public.reglas_contables_subcontratos for insert
to authenticated
with check (
  organization_id is not null
  and public.is_internal_org_member(organization_id)
);

drop policy if exists "reglas_contables_subcontratos_update_internal"
on public.reglas_contables_subcontratos;
create policy "reglas_contables_subcontratos_update_internal"
on public.reglas_contables_subcontratos for update
to authenticated
using (
  organization_id is not null
  and public.is_internal_org_member(organization_id)
)
with check (
  organization_id is not null
  and public.is_internal_org_member(organization_id)
);

grant execute on function public.obtener_regla_contable_subcontrato(uuid, text, text) to authenticated;
grant execute on function public.generar_asiento_subcontrato(uuid) to authenticated;
grant execute on function public.revertir_asiento_subcontrato(uuid, text) to authenticated;

with accounts as (
  select
    max(id::text) filter (where codigo = '5')::uuid as costo_id,
    max(id::text) filter (where codigo = '2.1.1.1')::uuid as proveedor_id,
    max(id::text) filter (where codigo = '1.1.1.2.1')::uuid as banco_id,
    max(id::text) filter (where codigo = '2.1.1.1')::uuid as retenciones_id
  from public.cuentas_contables
  where organization_id is null
    and codigo in ('5', '2.1.1.1', '1.1.1.2.1')
),
seed_rules as (
  select 'obra'::text as tipo_subcontrato, null::text as categoria_subcontrato, *
  from accounts
  where costo_id is not null
    and proveedor_id is not null
  union all
  select 'servicio', null::text, *
  from accounts
  where costo_id is not null
    and proveedor_id is not null
)
insert into public.reglas_contables_subcontratos (
  organization_id,
  tipo_subcontrato,
  categoria_subcontrato,
  cuenta_costo_subcontrato_id,
  cuenta_proveedor_id,
  cuenta_banco_id,
  cuenta_retenciones_id,
  requiere_centro_costo,
  prioridad,
  metadata
)
select
  null,
  seed_rules.tipo_subcontrato,
  seed_rules.categoria_subcontrato,
  seed_rules.costo_id,
  seed_rules.proveedor_id,
  seed_rules.banco_id,
  seed_rules.retenciones_id,
  true,
  100,
  jsonb_build_object('seed', 'schema_034', 'scope', 'global')
from seed_rules
where not exists (
  select 1
  from public.reglas_contables_subcontratos existing
  where existing.organization_id is null
    and lower(btrim(existing.tipo_subcontrato)) =
      lower(btrim(seed_rules.tipo_subcontrato))
    and lower(btrim(coalesce(existing.categoria_subcontrato, ''))) =
      lower(btrim(coalesce(seed_rules.categoria_subcontrato, '')))
);
