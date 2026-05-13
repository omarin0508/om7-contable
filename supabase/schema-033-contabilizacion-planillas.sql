create table if not exists public.planillas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  nombre text not null,
  tipo_planilla text not null default 'semanal',
  clasificacion_laboral text,
  periodo_desde date not null,
  periodo_hasta date not null,
  fecha_pago date,
  moneda text not null default 'CRC',
  total_salarios numeric not null default 0,
  total_cargas_sociales numeric not null default 0,
  total_retenciones numeric not null default 0,
  total_obligaciones numeric not null default 0,
  total_neto_pagar numeric not null default 0,
  payment_method_id uuid references public.payment_methods(id) on delete restrict,
  centro_costo_id uuid,
  presupuesto_id uuid,
  estado_operativo text not null default 'borrador',
  asiento_contable_id uuid references public.asientos_contables(id) on delete set null,
  estado_contable text not null default 'pendiente',
  contabilizacion_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.planillas
drop constraint if exists planillas_nombre_not_blank;

alter table public.planillas
add constraint planillas_nombre_not_blank
check (length(btrim(nombre)) > 0);

alter table public.planillas
drop constraint if exists planillas_periodo_check;

alter table public.planillas
add constraint planillas_periodo_check
check (periodo_hasta >= periodo_desde);

alter table public.planillas
drop constraint if exists planillas_totales_check;

alter table public.planillas
add constraint planillas_totales_check
check (
  total_salarios >= 0
  and total_cargas_sociales >= 0
  and total_retenciones >= 0
  and total_obligaciones >= 0
  and total_neto_pagar >= 0
);

alter table public.planillas
drop constraint if exists planillas_estado_operativo_check;

alter table public.planillas
add constraint planillas_estado_operativo_check
check (estado_operativo in ('borrador', 'revisada', 'aprobada', 'pagada', 'anulada'));

alter table public.planillas
drop constraint if exists planillas_estado_contable_check;

alter table public.planillas
add constraint planillas_estado_contable_check
check (estado_contable in ('pendiente', 'borrador', 'contabilizado', 'anulado', 'error'));

create index if not exists planillas_company_periodo_idx
on public.planillas (organization_id, company_id, periodo_desde, periodo_hasta);

create index if not exists planillas_estado_contable_idx
on public.planillas (organization_id, estado_contable);

create index if not exists planillas_asiento_contable_idx
on public.planillas (asiento_contable_id);

create table if not exists public.planillas_detalle (
  id uuid primary key default gen_random_uuid(),
  planilla_id uuid not null references public.planillas(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  trabajador_id uuid,
  trabajador_nombre text not null,
  clasificacion_laboral text,
  salario_bruto numeric not null default 0,
  cargas_sociales_patronales numeric not null default 0,
  retenciones numeric not null default 0,
  neto_pagar numeric not null default 0,
  centro_costo_id uuid,
  presupuesto_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.planillas_detalle
drop constraint if exists planillas_detalle_trabajador_not_blank;

alter table public.planillas_detalle
add constraint planillas_detalle_trabajador_not_blank
check (length(btrim(trabajador_nombre)) > 0);

alter table public.planillas_detalle
drop constraint if exists planillas_detalle_montos_check;

alter table public.planillas_detalle
add constraint planillas_detalle_montos_check
check (
  salario_bruto >= 0
  and cargas_sociales_patronales >= 0
  and retenciones >= 0
  and neto_pagar >= 0
);

create index if not exists planillas_detalle_planilla_idx
on public.planillas_detalle (planilla_id);

create index if not exists planillas_detalle_organization_idx
on public.planillas_detalle (organization_id);

create table if not exists public.planilla_pagos (
  id uuid primary key default gen_random_uuid(),
  planilla_id uuid not null references public.planillas(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  payment_method_id uuid not null references public.payment_methods(id) on delete restrict,
  amount numeric not null,
  payment_date date not null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.planilla_pagos
drop constraint if exists planilla_pagos_amount_check;

alter table public.planilla_pagos
add constraint planilla_pagos_amount_check
check (amount > 0);

create index if not exists planilla_pagos_planilla_idx
on public.planilla_pagos (planilla_id);

create index if not exists planilla_pagos_company_date_idx
on public.planilla_pagos (organization_id, company_id, payment_date);

create table if not exists public.reglas_contables_planillas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  tipo_planilla text not null,
  clasificacion_laboral text,
  cuenta_gasto_salarios_id uuid not null references public.cuentas_contables(id) on delete restrict,
  cuenta_cargas_sociales_id uuid references public.cuentas_contables(id) on delete restrict,
  cuenta_banco_id uuid references public.cuentas_contables(id) on delete restrict,
  cuenta_obligaciones_id uuid references public.cuentas_contables(id) on delete restrict,
  requiere_centro_costo boolean not null default true,
  prioridad integer not null default 100,
  activa boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reglas_contables_planillas
drop constraint if exists reglas_contables_planillas_tipo_not_blank;

alter table public.reglas_contables_planillas
add constraint reglas_contables_planillas_tipo_not_blank
check (length(btrim(tipo_planilla)) > 0);

create index if not exists reglas_contables_planillas_organization_idx
on public.reglas_contables_planillas (organization_id);

create index if not exists reglas_contables_planillas_tipo_clasificacion_idx
on public.reglas_contables_planillas (
  lower(btrim(tipo_planilla)),
  lower(btrim(coalesce(clasificacion_laboral, '')))
);

create index if not exists reglas_contables_planillas_activa_prioridad_idx
on public.reglas_contables_planillas (activa, prioridad);

create unique index if not exists reglas_contables_planillas_global_tipo_clasificacion_key
on public.reglas_contables_planillas (
  lower(btrim(tipo_planilla)),
  lower(btrim(coalesce(clasificacion_laboral, '')))
)
where organization_id is null;

create unique index if not exists reglas_contables_planillas_org_tipo_clasificacion_key
on public.reglas_contables_planillas (
  organization_id,
  lower(btrim(tipo_planilla)),
  lower(btrim(coalesce(clasificacion_laboral, '')))
)
where organization_id is not null;

create or replace function public.recalcular_totales_planilla(p_planilla_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.planillas planilla
  set
    total_salarios = coalesce(totals.total_salarios, planilla.total_salarios, 0),
    total_cargas_sociales = coalesce(totals.total_cargas_sociales, planilla.total_cargas_sociales, 0),
    total_retenciones = coalesce(totals.total_retenciones, planilla.total_retenciones, 0),
    total_neto_pagar = coalesce(totals.total_neto_pagar, planilla.total_neto_pagar, 0),
    total_obligaciones =
      coalesce(totals.total_cargas_sociales, 0)
        + coalesce(totals.total_retenciones, 0),
    updated_at = now()
  from (
    select
      count(*) as detail_count,
      coalesce(sum(salario_bruto), 0) as total_salarios,
      coalesce(sum(cargas_sociales_patronales), 0) as total_cargas_sociales,
      coalesce(sum(retenciones), 0) as total_retenciones,
      coalesce(sum(neto_pagar), 0) as total_neto_pagar
    from public.planillas_detalle
    where planilla_id = p_planilla_id
  ) totals
  where planilla.id = p_planilla_id
    and totals.detail_count > 0;
end;
$$;

create or replace function public.sync_planilla_totales_from_detalle()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalcular_totales_planilla(old.planilla_id);
    return old;
  end if;

  perform public.recalcular_totales_planilla(new.planilla_id);

  if tg_op = 'UPDATE' and old.planilla_id <> new.planilla_id then
    perform public.recalcular_totales_planilla(old.planilla_id);
  end if;

  return new;
end;
$$;

create or replace function public.validate_planilla_detalle()
returns trigger
language plpgsql
as $$
declare
  target_planilla public.planillas%rowtype;
begin
  select *
  into target_planilla
  from public.planillas
  where id = new.planilla_id;

  if target_planilla.id is null then
    raise exception 'La planilla no existe.';
  end if;

  if target_planilla.organization_id <> new.organization_id then
    raise exception 'El detalle debe pertenecer a la misma organizacion de la planilla.';
  end if;

  if target_planilla.estado_contable = 'contabilizado' then
    raise exception 'La planilla ya esta contabilizada. Reverti el asiento antes de modificar el detalle.';
  end if;

  return new;
end;
$$;

create or replace function public.validate_delete_planilla_detalle()
returns trigger
language plpgsql
as $$
declare
  target_estado text;
begin
  select estado_contable
  into target_estado
  from public.planillas
  where id = old.planilla_id;

  if target_estado = 'contabilizado' then
    raise exception 'La planilla ya esta contabilizada. Reverti el asiento antes de eliminar detalle.';
  end if;

  return old;
end;
$$;

create or replace function public.obtener_regla_contable_planilla(
  p_organization_id uuid,
  p_tipo_planilla text,
  p_clasificacion_laboral text default null
)
returns table (
  id uuid,
  organization_id uuid,
  tipo_planilla text,
  clasificacion_laboral text,
  cuenta_gasto_salarios_id uuid,
  cuenta_cargas_sociales_id uuid,
  cuenta_banco_id uuid,
  cuenta_obligaciones_id uuid,
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
    regla.tipo_planilla,
    regla.clasificacion_laboral,
    regla.cuenta_gasto_salarios_id,
    regla.cuenta_cargas_sociales_id,
    regla.cuenta_banco_id,
    regla.cuenta_obligaciones_id,
    regla.requiere_centro_costo,
    regla.prioridad,
    regla.activa,
    regla.metadata,
    regla.created_at,
    regla.updated_at
  from public.reglas_contables_planillas regla
  where regla.activa is true
    and lower(btrim(regla.tipo_planilla)) = lower(btrim(coalesce(p_tipo_planilla, 'semanal')))
    and (
      lower(btrim(coalesce(regla.clasificacion_laboral, ''))) =
        lower(btrim(coalesce(p_clasificacion_laboral, '')))
      or regla.clasificacion_laboral is null
    )
    and (
      regla.organization_id = p_organization_id
      or regla.organization_id is null
    )
  order by
    case when regla.organization_id = p_organization_id then 0 else 1 end,
    case
      when lower(btrim(coalesce(regla.clasificacion_laboral, ''))) =
        lower(btrim(coalesce(p_clasificacion_laboral, ''))) then 0
      else 1
    end,
    regla.prioridad asc,
    regla.created_at asc
  limit 1;
$$;

create or replace function public.set_payroll_accounting_error(
  p_planilla_id uuid,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.planillas
  set
    estado_contable = 'error',
    contabilizacion_error = p_message,
    updated_at = now()
  where id = p_planilla_id;
end;
$$;

create or replace function public.generar_asiento_planilla(p_planilla_id uuid)
returns public.asientos_contables
language plpgsql
security definer
set search_path = public
as $$
declare
  target_planilla public.planillas%rowtype;
  target_rule public.reglas_contables_planillas%rowtype;
  existing_asiento public.asientos_contables%rowtype;
  new_asiento public.asientos_contables%rowtype;
  salary_amount numeric;
  employer_amount numeric;
  net_amount numeric;
  obligations_amount numeric;
  debit_total numeric;
  payroll_date date;
  validation_message text;
begin
  select *
  into target_planilla
  from public.planillas
  where id = p_planilla_id
  for update;

  if target_planilla.id is null then
    raise exception 'Planilla no encontrada.';
  end if;

  if not public.is_internal_org_member(target_planilla.organization_id)
    and coalesce(auth.role(), '') <> 'service_role'
  then
    raise exception 'No tienes permisos para contabilizar esta planilla.';
  end if;

  perform public.recalcular_totales_planilla(target_planilla.id);

  select *
  into target_planilla
  from public.planillas
  where id = p_planilla_id
  for update;

  if target_planilla.estado_operativo not in ('revisada', 'aprobada', 'pagada') then
    validation_message := 'La planilla debe estar revisada, aprobada o pagada antes de generar asiento.';
    perform public.set_payroll_accounting_error(target_planilla.id, validation_message);
    raise exception '%', validation_message;
  end if;

  if target_planilla.periodo_hasta < target_planilla.periodo_desde then
    validation_message := 'La planilla tiene un rango de fechas invalido.';
    perform public.set_payroll_accounting_error(target_planilla.id, validation_message);
    raise exception '%', validation_message;
  end if;

  salary_amount := greatest(coalesce(target_planilla.total_salarios, 0), 0);
  employer_amount := greatest(coalesce(target_planilla.total_cargas_sociales, 0), 0);
  net_amount := greatest(coalesce(target_planilla.total_neto_pagar, 0), 0);

  if salary_amount <= 0 then
    validation_message := 'La planilla no tiene salarios suficientes para contabilizar.';
    perform public.set_payroll_accounting_error(target_planilla.id, validation_message);
    raise exception '%', validation_message;
  end if;

  if net_amount <= 0 then
    net_amount := greatest(salary_amount - greatest(coalesce(target_planilla.total_retenciones, 0), 0), 0);
  end if;

  debit_total := salary_amount + employer_amount;
  obligations_amount := greatest(debit_total - net_amount, 0);

  if target_planilla.asiento_contable_id is not null then
    select *
    into existing_asiento
    from public.asientos_contables
    where id = target_planilla.asiento_contable_id
    for update;

    if existing_asiento.id is not null and existing_asiento.estado = 'contabilizado' then
      update public.planillas
      set
        estado_contable = 'contabilizado',
        contabilizacion_error = null,
        updated_at = now()
      where id = target_planilla.id;
      return existing_asiento;
    end if;

    if existing_asiento.id is not null and existing_asiento.estado = 'borrador' then
      delete from public.asientos_contables
      where id = existing_asiento.id;
    end if;
  end if;

  select *
  into target_rule
  from public.obtener_regla_contable_planilla(
    target_planilla.organization_id,
    target_planilla.tipo_planilla,
    target_planilla.clasificacion_laboral
  );

  if target_rule.id is null then
    validation_message := 'No existe regla contable activa para esta planilla.';
    perform public.set_payroll_accounting_error(target_planilla.id, validation_message);
    raise exception '%', validation_message;
  end if;

  if employer_amount > 0 and target_rule.cuenta_cargas_sociales_id is null then
    validation_message := 'La planilla tiene cargas sociales pero la regla no tiene cuenta de cargas sociales.';
    perform public.set_payroll_accounting_error(target_planilla.id, validation_message);
    raise exception '%', validation_message;
  end if;

  if net_amount > 0 and target_rule.cuenta_banco_id is null then
    validation_message := 'La planilla requiere cuenta banco/caja para el pago neto.';
    perform public.set_payroll_accounting_error(target_planilla.id, validation_message);
    raise exception '%', validation_message;
  end if;

  if obligations_amount > 0 and target_rule.cuenta_obligaciones_id is null then
    validation_message := 'La planilla requiere cuenta de obligaciones laborales.';
    perform public.set_payroll_accounting_error(target_planilla.id, validation_message);
    raise exception '%', validation_message;
  end if;

  payroll_date := coalesce(target_planilla.fecha_pago, target_planilla.periodo_hasta, current_date);

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
    target_planilla.organization_id,
    payroll_date,
    to_char(payroll_date, 'YYYY-MM'),
    'Planilla ' || target_planilla.nombre,
    target_planilla.nombre,
    'planillas',
    'borrador',
    coalesce(target_planilla.moneda, 'CRC'),
    0,
    0,
    auth.uid(),
    jsonb_build_object(
      'source_type', 'payroll',
      'source_planilla_id', target_planilla.id,
      'company_id', target_planilla.company_id,
      'rule_id', target_rule.id,
      'tipo_planilla', target_planilla.tipo_planilla,
      'clasificacion_laboral', target_planilla.clasificacion_laboral
    )
  )
  returning *
  into new_asiento;

  insert into public.asiento_lineas (
    asiento_id,
    organization_id,
    cuenta_contable_id,
    descripcion,
    centro_costo_id,
    presupuesto_id,
    debito,
    credito,
    moneda,
    metadata
  )
  values (
    new_asiento.id,
    target_planilla.organization_id,
    target_rule.cuenta_gasto_salarios_id,
    'Gasto salarios planilla',
    target_planilla.centro_costo_id,
    target_planilla.presupuesto_id,
    salary_amount,
    0,
    coalesce(target_planilla.moneda, 'CRC'),
    jsonb_build_object('planilla_id', target_planilla.id, 'line_type', 'salarios')
  );

  if employer_amount > 0 then
    insert into public.asiento_lineas (
      asiento_id,
      organization_id,
      cuenta_contable_id,
      descripcion,
      centro_costo_id,
      presupuesto_id,
      debito,
      credito,
      moneda,
      metadata
    )
    values (
      new_asiento.id,
      target_planilla.organization_id,
      target_rule.cuenta_cargas_sociales_id,
      'Cargas sociales patronales',
      target_planilla.centro_costo_id,
      target_planilla.presupuesto_id,
      employer_amount,
      0,
      coalesce(target_planilla.moneda, 'CRC'),
      jsonb_build_object('planilla_id', target_planilla.id, 'line_type', 'cargas_sociales')
    );
  end if;

  if net_amount > 0 then
    insert into public.asiento_lineas (
      asiento_id,
      organization_id,
      cuenta_contable_id,
      descripcion,
      centro_costo_id,
      presupuesto_id,
      debito,
      credito,
      moneda,
      metadata
    )
    values (
      new_asiento.id,
      target_planilla.organization_id,
      target_rule.cuenta_banco_id,
      'Pago neto de planilla',
      target_planilla.centro_costo_id,
      target_planilla.presupuesto_id,
      0,
      net_amount,
      coalesce(target_planilla.moneda, 'CRC'),
      jsonb_build_object('planilla_id', target_planilla.id, 'line_type', 'banco')
    );
  end if;

  if obligations_amount > 0 then
    insert into public.asiento_lineas (
      asiento_id,
      organization_id,
      cuenta_contable_id,
      descripcion,
      centro_costo_id,
      presupuesto_id,
      debito,
      credito,
      moneda,
      metadata
    )
    values (
      new_asiento.id,
      target_planilla.organization_id,
      target_rule.cuenta_obligaciones_id,
      'Obligaciones laborales y retenciones por pagar',
      target_planilla.centro_costo_id,
      target_planilla.presupuesto_id,
      0,
      obligations_amount,
      coalesce(target_planilla.moneda, 'CRC'),
      jsonb_build_object('planilla_id', target_planilla.id, 'line_type', 'obligaciones')
    );
  end if;

  perform public.recalcular_totales_asiento(new_asiento.id);

  select *
  into new_asiento
  from public.asientos_contables
  where id = new_asiento.id;

  update public.planillas
  set
    asiento_contable_id = new_asiento.id,
    estado_contable = 'borrador',
    contabilizacion_error = null,
    updated_at = now()
  where id = target_planilla.id;

  return new_asiento;
end;
$$;

create or replace function public.revertir_asiento_planilla(
  p_planilla_id uuid,
  p_motivo text default 'Reversion contable de planilla'
)
returns public.asientos_contables
language plpgsql
security definer
set search_path = public
as $$
declare
  target_planilla public.planillas%rowtype;
  target_asiento public.asientos_contables%rowtype;
begin
  select *
  into target_planilla
  from public.planillas
  where id = p_planilla_id
  for update;

  if target_planilla.id is null then
    raise exception 'Planilla no encontrada.';
  end if;

  if not public.is_internal_org_member(target_planilla.organization_id)
    and coalesce(auth.role(), '') <> 'service_role'
  then
    raise exception 'No tienes permisos para revertir esta planilla.';
  end if;

  if target_planilla.asiento_contable_id is null then
    update public.planillas
    set estado_contable = 'pendiente', updated_at = now()
    where id = target_planilla.id;
    raise exception 'La planilla no tiene asiento contable asociado.';
  end if;

  select *
  into target_asiento
  from public.asientos_contables
  where id = target_planilla.asiento_contable_id
  for update;

  if target_asiento.id is null then
    update public.planillas
    set
      asiento_contable_id = null,
      estado_contable = 'pendiente',
      updated_at = now()
    where id = target_planilla.id;
    raise exception 'El asiento asociado no existe.';
  end if;

  if target_asiento.estado <> 'anulado' then
    update public.asientos_contables
    set
      estado = 'anulado',
      motivo_anulacion = coalesce(nullif(btrim(p_motivo), ''), 'Reversion contable de planilla'),
      anulado_at = now(),
      anulado_por = auth.uid(),
      updated_at = now()
    where id = target_asiento.id
    returning *
    into target_asiento;
  end if;

  update public.planillas
  set
    estado_contable = 'anulado',
    contabilizacion_error = null,
    updated_at = now()
  where id = target_planilla.id;

  return target_asiento;
end;
$$;

create or replace function public.sync_payroll_accounting_status_from_asiento()
returns trigger
language plpgsql
as $$
declare
  planilla_id uuid;
  next_status text;
begin
  if new.modulo_origen <> 'planillas' then
    return new;
  end if;

  planilla_id := nullif(new.metadata ->> 'source_planilla_id', '')::uuid;

  if planilla_id is null then
    return new;
  end if;

  next_status := case
    when new.estado = 'contabilizado' then 'contabilizado'
    when new.estado = 'anulado' then 'anulado'
    else 'borrador'
  end;

  update public.planillas
  set
    asiento_contable_id = new.id,
    estado_contable = next_status,
    contabilizacion_error = null,
    updated_at = now()
  where id = planilla_id;

  return new;
end;
$$;

create or replace function public.block_posted_payroll_accounting_changes()
returns trigger
language plpgsql
as $$
begin
  if old.estado_contable = 'contabilizado'
    and (
      old.organization_id is distinct from new.organization_id
      or old.company_id is distinct from new.company_id
      or old.nombre is distinct from new.nombre
      or old.tipo_planilla is distinct from new.tipo_planilla
      or old.clasificacion_laboral is distinct from new.clasificacion_laboral
      or old.periodo_desde is distinct from new.periodo_desde
      or old.periodo_hasta is distinct from new.periodo_hasta
      or old.fecha_pago is distinct from new.fecha_pago
      or old.moneda is distinct from new.moneda
      or old.total_salarios is distinct from new.total_salarios
      or old.total_cargas_sociales is distinct from new.total_cargas_sociales
      or old.total_retenciones is distinct from new.total_retenciones
      or old.total_obligaciones is distinct from new.total_obligaciones
      or old.total_neto_pagar is distinct from new.total_neto_pagar
      or old.payment_method_id is distinct from new.payment_method_id
      or old.centro_costo_id is distinct from new.centro_costo_id
      or old.presupuesto_id is distinct from new.presupuesto_id
    )
  then
    raise exception 'La planilla ya esta contabilizada. Reverti el asiento antes de modificar importes o clasificacion.';
  end if;

  return new;
end;
$$;

drop trigger if exists sync_planilla_totales_from_detalle_trigger
on public.planillas_detalle;
create trigger sync_planilla_totales_from_detalle_trigger
after insert or update or delete
on public.planillas_detalle
for each row execute function public.sync_planilla_totales_from_detalle();

drop trigger if exists validate_planilla_detalle_trigger
on public.planillas_detalle;
create trigger validate_planilla_detalle_trigger
before insert or update
on public.planillas_detalle
for each row execute function public.validate_planilla_detalle();

drop trigger if exists validate_delete_planilla_detalle_trigger
on public.planillas_detalle;
create trigger validate_delete_planilla_detalle_trigger
before delete
on public.planillas_detalle
for each row execute function public.validate_delete_planilla_detalle();

drop trigger if exists sync_payroll_accounting_status_from_asiento_trigger
on public.asientos_contables;
create trigger sync_payroll_accounting_status_from_asiento_trigger
after insert or update of estado
on public.asientos_contables
for each row execute function public.sync_payroll_accounting_status_from_asiento();

drop trigger if exists block_posted_payroll_accounting_changes_trigger
on public.planillas;
create trigger block_posted_payroll_accounting_changes_trigger
before update on public.planillas
for each row execute function public.block_posted_payroll_accounting_changes();

drop trigger if exists set_planillas_updated_at
on public.planillas;
create trigger set_planillas_updated_at
before update on public.planillas
for each row execute function public.set_updated_at();

drop trigger if exists set_reglas_contables_planillas_updated_at
on public.reglas_contables_planillas;
create trigger set_reglas_contables_planillas_updated_at
before update on public.reglas_contables_planillas
for each row execute function public.set_updated_at();

alter table public.planillas enable row level security;
alter table public.planillas_detalle enable row level security;
alter table public.planilla_pagos enable row level security;
alter table public.reglas_contables_planillas enable row level security;

drop policy if exists "planillas_select_internal" on public.planillas;
create policy "planillas_select_internal"
on public.planillas for select
to authenticated
using (public.is_internal_org_member(organization_id));

drop policy if exists "planillas_insert_internal" on public.planillas;
create policy "planillas_insert_internal"
on public.planillas for insert
to authenticated
with check (public.is_internal_org_member(organization_id));

drop policy if exists "planillas_update_internal" on public.planillas;
create policy "planillas_update_internal"
on public.planillas for update
to authenticated
using (public.is_internal_org_member(organization_id))
with check (public.is_internal_org_member(organization_id));

drop policy if exists "planillas_detalle_select_internal" on public.planillas_detalle;
create policy "planillas_detalle_select_internal"
on public.planillas_detalle for select
to authenticated
using (public.is_internal_org_member(organization_id));

drop policy if exists "planillas_detalle_insert_internal" on public.planillas_detalle;
create policy "planillas_detalle_insert_internal"
on public.planillas_detalle for insert
to authenticated
with check (public.is_internal_org_member(organization_id));

drop policy if exists "planillas_detalle_update_internal" on public.planillas_detalle;
create policy "planillas_detalle_update_internal"
on public.planillas_detalle for update
to authenticated
using (public.is_internal_org_member(organization_id))
with check (public.is_internal_org_member(organization_id));

drop policy if exists "planillas_detalle_delete_internal" on public.planillas_detalle;
create policy "planillas_detalle_delete_internal"
on public.planillas_detalle for delete
to authenticated
using (public.is_internal_org_member(organization_id));

drop policy if exists "planilla_pagos_select_internal" on public.planilla_pagos;
create policy "planilla_pagos_select_internal"
on public.planilla_pagos for select
to authenticated
using (public.is_internal_org_member(organization_id));

drop policy if exists "planilla_pagos_insert_internal" on public.planilla_pagos;
create policy "planilla_pagos_insert_internal"
on public.planilla_pagos for insert
to authenticated
with check (public.is_internal_org_member(organization_id));

drop policy if exists "reglas_contables_planillas_select_internal"
on public.reglas_contables_planillas;
create policy "reglas_contables_planillas_select_internal"
on public.reglas_contables_planillas for select
to authenticated
using (
  organization_id is null
  or public.is_internal_org_member(organization_id)
);

drop policy if exists "reglas_contables_planillas_insert_internal"
on public.reglas_contables_planillas;
create policy "reglas_contables_planillas_insert_internal"
on public.reglas_contables_planillas for insert
to authenticated
with check (
  organization_id is not null
  and public.is_internal_org_member(organization_id)
);

drop policy if exists "reglas_contables_planillas_update_internal"
on public.reglas_contables_planillas;
create policy "reglas_contables_planillas_update_internal"
on public.reglas_contables_planillas for update
to authenticated
using (
  organization_id is not null
  and public.is_internal_org_member(organization_id)
)
with check (
  organization_id is not null
  and public.is_internal_org_member(organization_id)
);

grant execute on function public.obtener_regla_contable_planilla(uuid, text, text) to authenticated;
grant execute on function public.generar_asiento_planilla(uuid) to authenticated;
grant execute on function public.revertir_asiento_planilla(uuid, text) to authenticated;

with accounts as (
  select
    max(id::text) filter (where codigo = '6.9')::uuid as salarios_id,
    max(id::text) filter (where codigo = '6.3')::uuid as cargas_sociales_id,
    max(id::text) filter (where codigo = '1.1.1.2.1')::uuid as banco_id,
    max(id::text) filter (where codigo = '2.1.1.1')::uuid as obligaciones_id
  from public.cuentas_contables
  where organization_id is null
    and codigo in ('6.9', '6.3', '1.1.1.2.1', '2.1.1.1')
),
seed_rules as (
  select 'semanal'::text as tipo_planilla, null::text as clasificacion_laboral, *
  from accounts
  where salarios_id is not null
    and banco_id is not null
    and obligaciones_id is not null
  union all
  select 'quincenal', null::text, *
  from accounts
  where salarios_id is not null
    and banco_id is not null
    and obligaciones_id is not null
  union all
  select 'mensual', null::text, *
  from accounts
  where salarios_id is not null
    and banco_id is not null
    and obligaciones_id is not null
)
insert into public.reglas_contables_planillas (
  organization_id,
  tipo_planilla,
  clasificacion_laboral,
  cuenta_gasto_salarios_id,
  cuenta_cargas_sociales_id,
  cuenta_banco_id,
  cuenta_obligaciones_id,
  requiere_centro_costo,
  prioridad,
  metadata
)
select
  null,
  seed_rules.tipo_planilla,
  seed_rules.clasificacion_laboral,
  seed_rules.salarios_id,
  seed_rules.cargas_sociales_id,
  seed_rules.banco_id,
  seed_rules.obligaciones_id,
  true,
  100,
  jsonb_build_object('seed', 'schema_033', 'scope', 'global')
from seed_rules
where not exists (
  select 1
  from public.reglas_contables_planillas existing
  where existing.organization_id is null
    and lower(btrim(existing.tipo_planilla)) =
      lower(btrim(seed_rules.tipo_planilla))
    and lower(btrim(coalesce(existing.clasificacion_laboral, ''))) =
      lower(btrim(coalesce(seed_rules.clasificacion_laboral, '')))
);
