alter table public.purchases
add column if not exists asiento_contable_id uuid references public.asientos_contables(id) on delete set null;

alter table public.purchases
add column if not exists estado_contable text not null default 'pendiente';

alter table public.purchases
add column if not exists contabilizacion_error text;

alter table public.purchases
drop constraint if exists purchases_estado_contable_check;

alter table public.purchases
add constraint purchases_estado_contable_check
check (estado_contable in ('pendiente', 'borrador', 'contabilizado', 'anulado', 'error'));

create index if not exists purchases_asiento_contable_idx
on public.purchases (asiento_contable_id);

create index if not exists purchases_estado_contable_idx
on public.purchases (organization_id, estado_contable);

create table if not exists public.reglas_contables_compras (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  categoria_compra text not null,
  cuenta_debito_id uuid not null references public.cuentas_contables(id) on delete restrict,
  cuenta_credito_id uuid references public.cuentas_contables(id) on delete restrict,
  cuenta_iva_id uuid references public.cuentas_contables(id) on delete restrict,
  requiere_centro_costo boolean not null default false,
  activa boolean not null default true,
  prioridad integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.reglas_contables_compras
drop constraint if exists reglas_contables_compras_categoria_not_blank;

alter table public.reglas_contables_compras
add constraint reglas_contables_compras_categoria_not_blank
check (length(btrim(categoria_compra)) > 0);

create index if not exists reglas_contables_compras_organization_idx
on public.reglas_contables_compras (organization_id);

create index if not exists reglas_contables_compras_categoria_idx
on public.reglas_contables_compras (lower(btrim(categoria_compra)));

create index if not exists reglas_contables_compras_activa_prioridad_idx
on public.reglas_contables_compras (activa, prioridad);

create unique index if not exists reglas_contables_compras_global_categoria_key
on public.reglas_contables_compras (lower(btrim(categoria_compra)))
where organization_id is null;

create unique index if not exists reglas_contables_compras_org_categoria_key
on public.reglas_contables_compras (organization_id, lower(btrim(categoria_compra)))
where organization_id is not null;

create or replace function public.obtener_regla_contable_compra(
  p_organization_id uuid,
  p_categoria_compra text
)
returns table (
  id uuid,
  organization_id uuid,
  categoria_compra text,
  cuenta_debito_id uuid,
  cuenta_credito_id uuid,
  cuenta_iva_id uuid,
  requiere_centro_costo boolean,
  activa boolean,
  prioridad integer,
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
    regla.categoria_compra,
    regla.cuenta_debito_id,
    regla.cuenta_credito_id,
    regla.cuenta_iva_id,
    regla.requiere_centro_costo,
    regla.activa,
    regla.prioridad,
    regla.metadata,
    regla.created_at
  from public.reglas_contables_compras regla
  where regla.activa is true
    and lower(btrim(regla.categoria_compra)) = lower(btrim(coalesce(p_categoria_compra, '')))
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

create or replace function public.set_purchase_accounting_error(
  p_purchase_id uuid,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.purchases
  set
    estado_contable = 'error',
    contabilizacion_error = p_message,
    updated_at = now()
  where id = p_purchase_id;
end;
$$;

create or replace function public.generar_asiento_compra(p_compra_id uuid)
returns public.asientos_contables
language plpgsql
security definer
set search_path = public
as $$
declare
  target_purchase public.purchases%rowtype;
  target_rule public.reglas_contables_compras%rowtype;
  existing_asiento public.asientos_contables%rowtype;
  new_asiento public.asientos_contables%rowtype;
  subtotal_amount numeric;
  tax_amount numeric;
  total_amount numeric;
  purchase_date date;
  period_label text;
  validation_message text;
begin
  select *
  into target_purchase
  from public.purchases
  where id = p_compra_id
  for update;

  if target_purchase.id is null then
    raise exception 'Compra no encontrada.';
  end if;

  if not public.is_internal_org_member(target_purchase.organization_id)
    and coalesce(auth.role(), '') <> 'service_role'
  then
    raise exception 'No tienes permisos para contabilizar esta compra.';
  end if;

  if target_purchase.review_status not in ('reviewed', 'approved') then
    validation_message := 'La compra debe estar revisada o aprobada antes de generar asiento.';
    perform public.set_purchase_accounting_error(target_purchase.id, validation_message);
    raise exception '%', validation_message;
  end if;

  if coalesce(target_purchase.counterparty_id::text, btrim(coalesce(target_purchase.supplier_name, '')), '') = '' then
    validation_message := 'La compra requiere proveedor o contraparte valida.';
    perform public.set_purchase_accounting_error(target_purchase.id, validation_message);
    raise exception '%', validation_message;
  end if;

  if btrim(coalesce(target_purchase.category, '')) = '' then
    validation_message := 'La compra requiere categoria contable.';
    perform public.set_purchase_accounting_error(target_purchase.id, validation_message);
    raise exception '%', validation_message;
  end if;

  if target_purchase.asiento_contable_id is not null then
    select *
    into existing_asiento
    from public.asientos_contables
    where id = target_purchase.asiento_contable_id
    for update;

    if existing_asiento.id is not null and existing_asiento.estado = 'contabilizado' then
      update public.purchases
      set
        estado_contable = 'contabilizado',
        contabilizacion_error = null,
        updated_at = now()
      where id = target_purchase.id;
      return existing_asiento;
    end if;

    if existing_asiento.id is not null and existing_asiento.estado = 'borrador' then
      delete from public.asientos_contables
      where id = existing_asiento.id;
    end if;
  end if;

  select *
  into target_rule
  from public.obtener_regla_contable_compra(
    target_purchase.organization_id,
    target_purchase.category
  );

  if target_rule.id is null then
    validation_message := 'No existe regla contable activa para la categoria de compra.';
    perform public.set_purchase_accounting_error(target_purchase.id, validation_message);
    raise exception '%', validation_message;
  end if;

  if target_rule.cuenta_credito_id is null then
    validation_message := 'La regla contable de compra requiere cuenta credito.';
    perform public.set_purchase_accounting_error(target_purchase.id, validation_message);
    raise exception '%', validation_message;
  end if;

  subtotal_amount := greatest(coalesce(target_purchase.subtotal, 0), 0);
  tax_amount := greatest(coalesce(target_purchase.tax, 0), 0);
  total_amount := greatest(coalesce(target_purchase.total, 0), 0);

  if total_amount <= 0 then
    total_amount := subtotal_amount + tax_amount;
  end if;

  if total_amount <= 0 then
    validation_message := 'La compra no tiene monto suficiente para contabilizar.';
    perform public.set_purchase_accounting_error(target_purchase.id, validation_message);
    raise exception '%', validation_message;
  end if;

  if tax_amount > 0 and target_rule.cuenta_iva_id is null then
    validation_message := 'La compra tiene IVA pero la regla no tiene cuenta IVA credito.';
    perform public.set_purchase_accounting_error(target_purchase.id, validation_message);
    raise exception '%', validation_message;
  end if;

  if abs((subtotal_amount + tax_amount) - total_amount) >= 0.01 then
    subtotal_amount := greatest(total_amount - tax_amount, 0);
  end if;

  purchase_date := coalesce(target_purchase.purchase_date, current_date);
  period_label := to_char(purchase_date, 'YYYY-MM');

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
    target_purchase.organization_id,
    purchase_date,
    period_label,
    'Compra ' || coalesce(target_purchase.document_number, target_purchase.supplier_name, target_purchase.id::text),
    target_purchase.document_number,
    'compras',
    target_purchase.source_document_id,
    'borrador',
    coalesce(target_purchase.currency, 'CRC'),
    0,
    0,
    auth.uid(),
    jsonb_build_object(
      'source_type', 'purchase',
      'source_purchase_id', target_purchase.id,
      'company_id', target_purchase.company_id,
      'rule_id', target_rule.id,
      'category', target_purchase.category
    )
  )
  returning *
  into new_asiento;

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
      target_purchase.organization_id,
      target_rule.cuenta_debito_id,
      coalesce(target_purchase.description, 'Base de compra'),
      target_purchase.counterparty_id,
      target_purchase.suggested_cost_center_id,
      target_purchase.source_document_id,
      subtotal_amount,
      0,
      coalesce(target_purchase.currency, 'CRC'),
      jsonb_build_object('purchase_id', target_purchase.id, 'line_type', 'base')
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
      target_purchase.organization_id,
      target_rule.cuenta_iva_id,
      'IVA credito fiscal compra',
      target_purchase.counterparty_id,
      target_purchase.suggested_cost_center_id,
      target_purchase.source_document_id,
      tax_amount,
      0,
      coalesce(target_purchase.currency, 'CRC'),
      jsonb_build_object('purchase_id', target_purchase.id, 'line_type', 'iva_credito')
    );
  end if;

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
    target_purchase.organization_id,
    target_rule.cuenta_credito_id,
    'Cuenta por pagar compra',
    target_purchase.counterparty_id,
    target_purchase.suggested_cost_center_id,
    target_purchase.source_document_id,
    0,
    total_amount,
    coalesce(target_purchase.currency, 'CRC'),
    jsonb_build_object('purchase_id', target_purchase.id, 'line_type', 'contrapartida')
  );

  perform public.recalcular_totales_asiento(new_asiento.id);

  select *
  into new_asiento
  from public.asientos_contables
  where id = new_asiento.id;

  update public.purchases
  set
    asiento_contable_id = new_asiento.id,
    estado_contable = 'borrador',
    contabilizacion_error = null,
    updated_at = now()
  where id = target_purchase.id;

  return new_asiento;
end;
$$;

create or replace function public.revertir_asiento_compra(
  p_compra_id uuid,
  p_motivo text default 'Reversion contable de compra'
)
returns public.asientos_contables
language plpgsql
security definer
set search_path = public
as $$
declare
  target_purchase public.purchases%rowtype;
  target_asiento public.asientos_contables%rowtype;
begin
  select *
  into target_purchase
  from public.purchases
  where id = p_compra_id
  for update;

  if target_purchase.id is null then
    raise exception 'Compra no encontrada.';
  end if;

  if not public.is_internal_org_member(target_purchase.organization_id)
    and coalesce(auth.role(), '') <> 'service_role'
  then
    raise exception 'No tienes permisos para revertir esta compra.';
  end if;

  if target_purchase.asiento_contable_id is null then
    update public.purchases
    set estado_contable = 'pendiente', updated_at = now()
    where id = target_purchase.id;
    raise exception 'La compra no tiene asiento contable asociado.';
  end if;

  select *
  into target_asiento
  from public.asientos_contables
  where id = target_purchase.asiento_contable_id
  for update;

  if target_asiento.id is null then
    update public.purchases
    set
      asiento_contable_id = null,
      estado_contable = 'pendiente',
      updated_at = now()
    where id = target_purchase.id;
    raise exception 'El asiento asociado no existe.';
  end if;

  if target_asiento.estado <> 'anulado' then
    update public.asientos_contables
    set
      estado = 'anulado',
      motivo_anulacion = coalesce(nullif(btrim(p_motivo), ''), 'Reversion contable de compra'),
      anulado_at = now(),
      anulado_por = auth.uid(),
      updated_at = now()
    where id = target_asiento.id
    returning *
    into target_asiento;
  end if;

  update public.purchases
  set
    estado_contable = 'anulado',
    contabilizacion_error = null,
    updated_at = now()
  where id = target_purchase.id;

  return target_asiento;
end;
$$;

create or replace function public.sync_purchase_accounting_status_from_asiento()
returns trigger
language plpgsql
as $$
declare
  purchase_id uuid;
  next_status text;
begin
  if new.modulo_origen <> 'compras' then
    return new;
  end if;

  purchase_id := nullif(new.metadata ->> 'source_purchase_id', '')::uuid;

  if purchase_id is null then
    return new;
  end if;

  next_status := case
    when new.estado = 'contabilizado' then 'contabilizado'
    when new.estado = 'anulado' then 'anulado'
    else 'borrador'
  end;

  update public.purchases
  set
    asiento_contable_id = new.id,
    estado_contable = next_status,
    contabilizacion_error = null,
    updated_at = now()
  where id = purchase_id;

  return new;
end;
$$;

drop trigger if exists sync_purchase_accounting_status_from_asiento_trigger
on public.asientos_contables;
create trigger sync_purchase_accounting_status_from_asiento_trigger
after insert or update of estado
on public.asientos_contables
for each row execute function public.sync_purchase_accounting_status_from_asiento();

create or replace function public.block_posted_purchase_accounting_changes()
returns trigger
language plpgsql
as $$
begin
  if old.estado_contable = 'contabilizado'
    and (
      old.organization_id is distinct from new.organization_id
      or old.company_id is distinct from new.company_id
      or old.counterparty_id is distinct from new.counterparty_id
      or old.purchase_date is distinct from new.purchase_date
      or old.category is distinct from new.category
      or old.subtotal is distinct from new.subtotal
      or old.tax is distinct from new.tax
      or old.total is distinct from new.total
      or old.currency is distinct from new.currency
      or old.suggested_cost_center_id is distinct from new.suggested_cost_center_id
    )
  then
    raise exception 'La compra ya esta contabilizada. Reverti el asiento antes de modificar importes o clasificacion.';
  end if;

  return new;
end;
$$;

drop trigger if exists block_posted_purchase_accounting_changes_trigger
on public.purchases;
create trigger block_posted_purchase_accounting_changes_trigger
before update on public.purchases
for each row execute function public.block_posted_purchase_accounting_changes();

alter table public.reglas_contables_compras enable row level security;

drop policy if exists "reglas_contables_compras_select_internal"
on public.reglas_contables_compras;
create policy "reglas_contables_compras_select_internal"
on public.reglas_contables_compras for select
to authenticated
using (
  organization_id is null
  or public.is_internal_org_member(organization_id)
);

drop policy if exists "reglas_contables_compras_insert_internal"
on public.reglas_contables_compras;
create policy "reglas_contables_compras_insert_internal"
on public.reglas_contables_compras for insert
to authenticated
with check (
  organization_id is not null
  and public.is_internal_org_member(organization_id)
);

drop policy if exists "reglas_contables_compras_update_internal"
on public.reglas_contables_compras;
create policy "reglas_contables_compras_update_internal"
on public.reglas_contables_compras for update
to authenticated
using (
  organization_id is not null
  and public.is_internal_org_member(organization_id)
)
with check (
  organization_id is not null
  and public.is_internal_org_member(organization_id)
);

grant execute on function public.obtener_regla_contable_compra(uuid, text) to authenticated;
grant execute on function public.generar_asiento_compra(uuid) to authenticated;
grant execute on function public.revertir_asiento_compra(uuid, text) to authenticated;

with base_rules as (
  select *
  from (
    values
      ('Operaciones', '5'),
      ('Servicios profesionales', '6.4'),
      ('Tecnologia', '6.7'),
      ('Impuestos', '6.3'),
      ('Administrativo', '6.9'),
      ('Otros', '6.9')
  ) as rule_seed(categoria_compra, debit_code)
),
resolved_accounts as (
  select
    base_rules.categoria_compra,
    debit.id as cuenta_debito_id,
    credit.id as cuenta_credito_id,
    iva.id as cuenta_iva_id
  from base_rules
  join public.cuentas_contables debit
    on debit.organization_id is null
    and debit.codigo = base_rules.debit_code
  join public.cuentas_contables credit
    on credit.organization_id is null
    and credit.codigo = '2.1.1.1'
  left join public.cuentas_contables iva
    on iva.organization_id is null
    and iva.codigo = '1.1.5.2'
)
insert into public.reglas_contables_compras (
  organization_id,
  categoria_compra,
  cuenta_debito_id,
  cuenta_credito_id,
  cuenta_iva_id,
  requiere_centro_costo,
  prioridad,
  metadata
)
select
  null,
  resolved_accounts.categoria_compra,
  resolved_accounts.cuenta_debito_id,
  resolved_accounts.cuenta_credito_id,
  resolved_accounts.cuenta_iva_id,
  true,
  100,
  jsonb_build_object('seed', 'schema_030', 'scope', 'global')
from resolved_accounts
where not exists (
  select 1
  from public.reglas_contables_compras existing
  where existing.organization_id is null
    and lower(btrim(existing.categoria_compra)) =
      lower(btrim(resolved_accounts.categoria_compra))
);
