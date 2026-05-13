alter table public.invoices
add column if not exists asiento_contable_id uuid references public.asientos_contables(id) on delete set null;

alter table public.invoices
add column if not exists estado_contable text not null default 'pendiente';

alter table public.invoices
add column if not exists contabilizacion_error text;

alter table public.invoices
drop constraint if exists invoices_estado_contable_check;

alter table public.invoices
add constraint invoices_estado_contable_check
check (estado_contable in ('pendiente', 'borrador', 'contabilizado', 'anulado', 'error'));

create index if not exists invoices_asiento_contable_idx
on public.invoices (asiento_contable_id);

create index if not exists invoices_estado_contable_idx
on public.invoices (organization_id, estado_contable);

create table if not exists public.reglas_contables_facturas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  categoria_factura text not null,
  cuenta_clientes_id uuid not null references public.cuentas_contables(id) on delete restrict,
  cuenta_ingreso_id uuid not null references public.cuentas_contables(id) on delete restrict,
  cuenta_iva_debito_id uuid references public.cuentas_contables(id) on delete restrict,
  requiere_centro_costo boolean not null default false,
  prioridad integer not null default 100,
  activa boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.reglas_contables_facturas
drop constraint if exists reglas_contables_facturas_categoria_not_blank;

alter table public.reglas_contables_facturas
add constraint reglas_contables_facturas_categoria_not_blank
check (length(btrim(categoria_factura)) > 0);

create index if not exists reglas_contables_facturas_organization_idx
on public.reglas_contables_facturas (organization_id);

create index if not exists reglas_contables_facturas_categoria_idx
on public.reglas_contables_facturas (lower(btrim(categoria_factura)));

create index if not exists reglas_contables_facturas_activa_prioridad_idx
on public.reglas_contables_facturas (activa, prioridad);

create unique index if not exists reglas_contables_facturas_global_categoria_key
on public.reglas_contables_facturas (lower(btrim(categoria_factura)))
where organization_id is null;

create unique index if not exists reglas_contables_facturas_org_categoria_key
on public.reglas_contables_facturas (organization_id, lower(btrim(categoria_factura)))
where organization_id is not null;

create or replace function public.obtener_regla_contable_factura(
  p_organization_id uuid,
  p_categoria_factura text
)
returns table (
  id uuid,
  organization_id uuid,
  categoria_factura text,
  cuenta_clientes_id uuid,
  cuenta_ingreso_id uuid,
  cuenta_iva_debito_id uuid,
  requiere_centro_costo boolean,
  prioridad integer,
  activa boolean,
  metadata jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    regla.id,
    regla.organization_id,
    regla.categoria_factura,
    regla.cuenta_clientes_id,
    regla.cuenta_ingreso_id,
    regla.cuenta_iva_debito_id,
    regla.requiere_centro_costo,
    regla.prioridad,
    regla.activa,
    regla.metadata,
    regla.created_at
  from public.reglas_contables_facturas regla
  where regla.activa is true
    and lower(btrim(regla.categoria_factura)) = lower(btrim(coalesce(p_categoria_factura, 'factura')))
    and (
      regla.organization_id = p_organization_id
      or regla.organization_id is null
    )
  order by
    case when regla.organization_id = p_organization_id then 0 else 1 end,
    regla.prioridad asc,
    regla.created_at asc
  limit 1;
$$;

create or replace function public.set_invoice_accounting_error(
  p_invoice_id uuid,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.invoices
  set
    estado_contable = 'error',
    contabilizacion_error = p_message
  where id = p_invoice_id;
end;
$$;

create or replace function public.generar_asiento_factura(p_factura_id uuid)
returns public.asientos_contables
language plpgsql
security definer
set search_path = public
as $$
declare
  target_invoice public.invoices%rowtype;
  target_rule public.reglas_contables_facturas%rowtype;
  existing_asiento public.asientos_contables%rowtype;
  new_asiento public.asientos_contables%rowtype;
  subtotal_amount numeric;
  tax_amount numeric;
  total_amount numeric;
  invoice_date date;
  period_label text;
  invoice_category text;
  validation_message text;
begin
  select *
  into target_invoice
  from public.invoices
  where id = p_factura_id
  for update;

  if target_invoice.id is null then
    raise exception 'Factura no encontrada.';
  end if;

  if not public.is_internal_org_member(target_invoice.organization_id)
    and coalesce(auth.role(), '') <> 'service_role'
  then
    raise exception 'No tienes permisos para contabilizar esta factura.';
  end if;

  if target_invoice.review_status not in ('reviewed', 'approved') then
    validation_message := 'La factura debe estar revisada o aprobada antes de generar asiento.';
    perform public.set_invoice_accounting_error(target_invoice.id, validation_message);
    raise exception '%', validation_message;
  end if;

  if coalesce(target_invoice.counterparty_id::text, btrim(coalesce(target_invoice.proveedor, '')), '') = '' then
    validation_message := 'La factura requiere cliente o contraparte valida.';
    perform public.set_invoice_accounting_error(target_invoice.id, validation_message);
    raise exception '%', validation_message;
  end if;

  invoice_category := coalesce(nullif(btrim(target_invoice.tipo_documento), ''), 'factura');

  if target_invoice.asiento_contable_id is not null then
    select *
    into existing_asiento
    from public.asientos_contables
    where id = target_invoice.asiento_contable_id
    for update;

    if existing_asiento.id is not null and existing_asiento.estado = 'contabilizado' then
      update public.invoices
      set
        estado_contable = 'contabilizado',
        contabilizacion_error = null
      where id = target_invoice.id;
      return existing_asiento;
    end if;

    if existing_asiento.id is not null and existing_asiento.estado = 'borrador' then
      delete from public.asientos_contables
      where id = existing_asiento.id;
    end if;
  end if;

  select *
  into target_rule
  from public.obtener_regla_contable_factura(
    target_invoice.organization_id,
    invoice_category
  );

  if target_rule.id is null then
    validation_message := 'No existe regla contable activa para esta categoria de factura.';
    perform public.set_invoice_accounting_error(target_invoice.id, validation_message);
    raise exception '%', validation_message;
  end if;

  subtotal_amount := greatest(coalesce(target_invoice.subtotal, 0), 0);
  tax_amount := greatest(coalesce(target_invoice.impuesto, 0), 0);
  total_amount := greatest(coalesce(target_invoice.total, 0), 0);

  if total_amount <= 0 then
    total_amount := subtotal_amount + tax_amount;
  end if;

  if total_amount <= 0 then
    validation_message := 'La factura no tiene monto suficiente para contabilizar.';
    perform public.set_invoice_accounting_error(target_invoice.id, validation_message);
    raise exception '%', validation_message;
  end if;

  if tax_amount > 0 and target_rule.cuenta_iva_debito_id is null then
    validation_message := 'La factura tiene IVA pero la regla no tiene cuenta IVA debito.';
    perform public.set_invoice_accounting_error(target_invoice.id, validation_message);
    raise exception '%', validation_message;
  end if;

  if abs((subtotal_amount + tax_amount) - total_amount) >= 0.01 then
    subtotal_amount := greatest(total_amount - tax_amount, 0);
  end if;

  invoice_date := coalesce(target_invoice.fecha, current_date);
  period_label := to_char(invoice_date, 'YYYY-MM');

  insert into public.asientos_contables (
    organization_id,
    fecha,
    periodo,
    descripcion,
    referencia,
    modulo_origen,
    documento_origen_id,
    estado,
    moneda,
    total_debito,
    total_credito,
    creado_por,
    metadata
  )
  values (
    target_invoice.organization_id,
    invoice_date,
    period_label,
    'Factura ' || coalesce(target_invoice.numero_documento, target_invoice.proveedor, target_invoice.id::text),
    target_invoice.numero_documento,
    'facturas',
    target_invoice.source_document_id,
    'borrador',
    coalesce(target_invoice.moneda, 'CRC'),
    0,
    0,
    auth.uid(),
    jsonb_build_object(
      'source_type', 'invoice',
      'source_invoice_id', target_invoice.id,
      'company_id', target_invoice.company_id,
      'rule_id', target_rule.id,
      'category', invoice_category
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
    documento_origen_id,
    debito,
    credito,
    moneda,
    metadata
  )
  values (
    new_asiento.id,
    target_invoice.organization_id,
    target_rule.cuenta_clientes_id,
    'Cuenta por cobrar factura',
    target_invoice.counterparty_id,
    target_invoice.suggested_cost_center_id,
    target_invoice.source_document_id,
    total_amount,
    0,
    coalesce(target_invoice.moneda, 'CRC'),
    jsonb_build_object('invoice_id', target_invoice.id, 'line_type', 'clientes')
  );

  if subtotal_amount > 0 then
    insert into public.asiento_lineas (
      asiento_id,
      organization_id,
      cuenta_contable_id,
      descripcion,
      tercero_id,
      centro_costo_id,
      documento_origen_id,
      debito,
      credito,
      moneda,
      metadata
    )
    values (
      new_asiento.id,
      target_invoice.organization_id,
      target_rule.cuenta_ingreso_id,
      coalesce(target_invoice.notas, 'Ingreso por factura'),
      target_invoice.counterparty_id,
      target_invoice.suggested_cost_center_id,
      target_invoice.source_document_id,
      0,
      subtotal_amount,
      coalesce(target_invoice.moneda, 'CRC'),
      jsonb_build_object('invoice_id', target_invoice.id, 'line_type', 'ingreso')
    );
  end if;

  if tax_amount > 0 then
    insert into public.asiento_lineas (
      asiento_id,
      organization_id,
      cuenta_contable_id,
      descripcion,
      tercero_id,
      centro_costo_id,
      documento_origen_id,
      debito,
      credito,
      moneda,
      metadata
    )
    values (
      new_asiento.id,
      target_invoice.organization_id,
      target_rule.cuenta_iva_debito_id,
      'IVA debito fiscal factura',
      target_invoice.counterparty_id,
      target_invoice.suggested_cost_center_id,
      target_invoice.source_document_id,
      0,
      tax_amount,
      coalesce(target_invoice.moneda, 'CRC'),
      jsonb_build_object('invoice_id', target_invoice.id, 'line_type', 'iva_debito')
    );
  end if;

  perform public.recalcular_totales_asiento(new_asiento.id);

  select *
  into new_asiento
  from public.asientos_contables
  where id = new_asiento.id;

  update public.invoices
  set
    asiento_contable_id = new_asiento.id,
    estado_contable = 'borrador',
    contabilizacion_error = null
  where id = target_invoice.id;

  return new_asiento;
end;
$$;

create or replace function public.revertir_asiento_factura(
  p_factura_id uuid,
  p_motivo text default 'Reversion contable de factura'
)
returns public.asientos_contables
language plpgsql
security definer
set search_path = public
as $$
declare
  target_invoice public.invoices%rowtype;
  target_asiento public.asientos_contables%rowtype;
begin
  select *
  into target_invoice
  from public.invoices
  where id = p_factura_id
  for update;

  if target_invoice.id is null then
    raise exception 'Factura no encontrada.';
  end if;

  if not public.is_internal_org_member(target_invoice.organization_id)
    and coalesce(auth.role(), '') <> 'service_role'
  then
    raise exception 'No tienes permisos para revertir esta factura.';
  end if;

  if target_invoice.asiento_contable_id is null then
    update public.invoices
    set estado_contable = 'pendiente'
    where id = target_invoice.id;
    raise exception 'La factura no tiene asiento contable asociado.';
  end if;

  select *
  into target_asiento
  from public.asientos_contables
  where id = target_invoice.asiento_contable_id
  for update;

  if target_asiento.id is null then
    update public.invoices
    set
      asiento_contable_id = null,
      estado_contable = 'pendiente'
    where id = target_invoice.id;
    raise exception 'El asiento asociado no existe.';
  end if;

  if target_asiento.estado <> 'anulado' then
    update public.asientos_contables
    set
      estado = 'anulado',
      motivo_anulacion = coalesce(nullif(btrim(p_motivo), ''), 'Reversion contable de factura'),
      anulado_at = now(),
      anulado_por = auth.uid(),
      updated_at = now()
    where id = target_asiento.id
    returning *
    into target_asiento;
  end if;

  update public.invoices
  set
    estado_contable = 'anulado',
    contabilizacion_error = null
  where id = target_invoice.id;

  return target_asiento;
end;
$$;

create or replace function public.sync_invoice_accounting_status_from_asiento()
returns trigger
language plpgsql
as $$
declare
  invoice_id uuid;
  next_status text;
begin
  if new.modulo_origen <> 'facturas' then
    return new;
  end if;

  invoice_id := nullif(new.metadata ->> 'source_invoice_id', '')::uuid;

  if invoice_id is null then
    return new;
  end if;

  next_status := case
    when new.estado = 'contabilizado' then 'contabilizado'
    when new.estado = 'anulado' then 'anulado'
    else 'borrador'
  end;

  update public.invoices
  set
    asiento_contable_id = new.id,
    estado_contable = next_status,
    contabilizacion_error = null
  where id = invoice_id;

  return new;
end;
$$;

drop trigger if exists sync_invoice_accounting_status_from_asiento_trigger
on public.asientos_contables;
create trigger sync_invoice_accounting_status_from_asiento_trigger
after insert or update of estado
on public.asientos_contables
for each row execute function public.sync_invoice_accounting_status_from_asiento();

create or replace function public.block_posted_invoice_accounting_changes()
returns trigger
language plpgsql
as $$
begin
  if old.estado_contable = 'contabilizado'
    and (
      old.organization_id is distinct from new.organization_id
      or old.company_id is distinct from new.company_id
      or old.counterparty_id is distinct from new.counterparty_id
      or old.fecha is distinct from new.fecha
      or old.tipo_documento is distinct from new.tipo_documento
      or old.subtotal is distinct from new.subtotal
      or old.impuesto is distinct from new.impuesto
      or old.total is distinct from new.total
      or old.moneda is distinct from new.moneda
      or old.suggested_cost_center_id is distinct from new.suggested_cost_center_id
    )
  then
    raise exception 'La factura ya esta contabilizada. Reverti el asiento antes de modificar importes o clasificacion.';
  end if;

  return new;
end;
$$;

drop trigger if exists block_posted_invoice_accounting_changes_trigger
on public.invoices;
create trigger block_posted_invoice_accounting_changes_trigger
before update on public.invoices
for each row execute function public.block_posted_invoice_accounting_changes();

alter table public.reglas_contables_facturas enable row level security;

drop policy if exists "reglas_contables_facturas_select_internal"
on public.reglas_contables_facturas;
create policy "reglas_contables_facturas_select_internal"
on public.reglas_contables_facturas for select
to authenticated
using (
  organization_id is null
  or public.is_internal_org_member(organization_id)
);

drop policy if exists "reglas_contables_facturas_insert_internal"
on public.reglas_contables_facturas;
create policy "reglas_contables_facturas_insert_internal"
on public.reglas_contables_facturas for insert
to authenticated
with check (
  organization_id is not null
  and public.is_internal_org_member(organization_id)
);

drop policy if exists "reglas_contables_facturas_update_internal"
on public.reglas_contables_facturas;
create policy "reglas_contables_facturas_update_internal"
on public.reglas_contables_facturas for update
to authenticated
using (
  organization_id is not null
  and public.is_internal_org_member(organization_id)
)
with check (
  organization_id is not null
  and public.is_internal_org_member(organization_id)
);

grant execute on function public.obtener_regla_contable_factura(uuid, text) to authenticated;
grant execute on function public.generar_asiento_factura(uuid) to authenticated;
grant execute on function public.revertir_asiento_factura(uuid, text) to authenticated;

with resolved_accounts as (
  select
    clientes.id as cuenta_clientes_id,
    ingresos.id as cuenta_ingreso_id,
    iva.id as cuenta_iva_debito_id
  from public.cuentas_contables clientes
  join public.cuentas_contables ingresos
    on ingresos.organization_id is null
    and ingresos.codigo = '4.1.1'
  left join public.cuentas_contables iva
    on iva.organization_id is null
    and iva.codigo = '2.1.2.1'
  where clientes.organization_id is null
    and clientes.codigo = '1.1.3.1'
)
insert into public.reglas_contables_facturas (
  organization_id,
  categoria_factura,
  cuenta_clientes_id,
  cuenta_ingreso_id,
  cuenta_iva_debito_id,
  requiere_centro_costo,
  prioridad,
  metadata
)
select
  null,
  category,
  resolved_accounts.cuenta_clientes_id,
  resolved_accounts.cuenta_ingreso_id,
  resolved_accounts.cuenta_iva_debito_id,
  false,
  100,
  jsonb_build_object('seed', 'schema_031', 'scope', 'global')
from resolved_accounts
cross join (
  values ('factura'), ('servicio'), ('venta')
) as categories(category)
where not exists (
  select 1
  from public.reglas_contables_facturas existing
  where existing.organization_id is null
    and lower(btrim(existing.categoria_factura)) = lower(btrim(categories.category))
);
