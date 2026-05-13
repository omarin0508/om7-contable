alter table public.payment_methods
add column if not exists cuenta_contable_id uuid references public.cuentas_contables(id) on delete restrict;

create index if not exists payment_methods_cuenta_contable_idx
on public.payment_methods (cuenta_contable_id);

alter table public.purchase_payments
add column if not exists asiento_contable_id uuid references public.asientos_contables(id) on delete set null;

alter table public.purchase_payments
add column if not exists estado_contable text not null default 'pendiente';

alter table public.purchase_payments
add column if not exists contabilizacion_error text;

alter table public.purchase_payments
drop constraint if exists purchase_payments_estado_contable_check;

alter table public.purchase_payments
add constraint purchase_payments_estado_contable_check
check (estado_contable in ('pendiente', 'borrador', 'contabilizado', 'anulado', 'error'));

create index if not exists purchase_payments_asiento_contable_idx
on public.purchase_payments (asiento_contable_id);

create index if not exists purchase_payments_estado_contable_idx
on public.purchase_payments (organization_id, estado_contable);

alter table public.invoice_collections
add column if not exists asiento_contable_id uuid references public.asientos_contables(id) on delete set null;

alter table public.invoice_collections
add column if not exists estado_contable text not null default 'pendiente';

alter table public.invoice_collections
add column if not exists contabilizacion_error text;

alter table public.invoice_collections
drop constraint if exists invoice_collections_estado_contable_check;

alter table public.invoice_collections
add constraint invoice_collections_estado_contable_check
check (estado_contable in ('pendiente', 'borrador', 'contabilizado', 'anulado', 'error'));

create index if not exists invoice_collections_asiento_contable_idx
on public.invoice_collections (asiento_contable_id);

create index if not exists invoice_collections_estado_contable_idx
on public.invoice_collections (organization_id, estado_contable);

create table if not exists public.cash_bank_transfers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  source_payment_method_id uuid not null references public.payment_methods(id) on delete restrict,
  destination_payment_method_id uuid not null references public.payment_methods(id) on delete restrict,
  categoria_movimiento text not null default 'transferencia',
  amount numeric not null,
  transfer_date date not null,
  notes text,
  asiento_contable_id uuid references public.asientos_contables(id) on delete set null,
  estado_contable text not null default 'pendiente',
  contabilizacion_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cash_bank_transfers
drop constraint if exists cash_bank_transfers_amount_check;

alter table public.cash_bank_transfers
add constraint cash_bank_transfers_amount_check
check (amount > 0);

alter table public.cash_bank_transfers
drop constraint if exists cash_bank_transfers_different_methods_check;

alter table public.cash_bank_transfers
add constraint cash_bank_transfers_different_methods_check
check (source_payment_method_id <> destination_payment_method_id);

alter table public.cash_bank_transfers
drop constraint if exists cash_bank_transfers_estado_contable_check;

alter table public.cash_bank_transfers
add constraint cash_bank_transfers_estado_contable_check
check (estado_contable in ('pendiente', 'borrador', 'contabilizado', 'anulado', 'error'));

create index if not exists cash_bank_transfers_company_date_idx
on public.cash_bank_transfers (organization_id, company_id, transfer_date);

create index if not exists cash_bank_transfers_source_method_idx
on public.cash_bank_transfers (source_payment_method_id);

create index if not exists cash_bank_transfers_destination_method_idx
on public.cash_bank_transfers (destination_payment_method_id);

create index if not exists cash_bank_transfers_asiento_contable_idx
on public.cash_bank_transfers (asiento_contable_id);

create index if not exists cash_bank_transfers_estado_contable_idx
on public.cash_bank_transfers (organization_id, estado_contable);

create table if not exists public.reglas_contables_caja (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  tipo_movimiento text not null,
  categoria_movimiento text,
  cuenta_caja_banco_id uuid not null references public.cuentas_contables(id) on delete restrict,
  cuenta_contrapartida_id uuid not null references public.cuentas_contables(id) on delete restrict,
  cuenta_iva_id uuid references public.cuentas_contables(id) on delete restrict,
  requiere_centro_costo boolean not null default false,
  prioridad integer not null default 100,
  activa boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reglas_contables_caja
drop constraint if exists reglas_contables_caja_tipo_check;

alter table public.reglas_contables_caja
add constraint reglas_contables_caja_tipo_check
check (tipo_movimiento in ('egreso', 'ingreso', 'transferencia', 'reintegro', 'ajuste'));

create index if not exists reglas_contables_caja_organization_idx
on public.reglas_contables_caja (organization_id);

create index if not exists reglas_contables_caja_tipo_categoria_idx
on public.reglas_contables_caja (
  tipo_movimiento,
  lower(btrim(coalesce(categoria_movimiento, '')))
);

create index if not exists reglas_contables_caja_activa_prioridad_idx
on public.reglas_contables_caja (activa, prioridad);

create unique index if not exists reglas_contables_caja_global_tipo_categoria_key
on public.reglas_contables_caja (
  tipo_movimiento,
  lower(btrim(coalesce(categoria_movimiento, '')))
)
where organization_id is null;

create unique index if not exists reglas_contables_caja_org_tipo_categoria_key
on public.reglas_contables_caja (
  organization_id,
  tipo_movimiento,
  lower(btrim(coalesce(categoria_movimiento, '')))
)
where organization_id is not null;

create or replace function public.obtener_regla_contable_caja(
  p_organization_id uuid,
  p_tipo_movimiento text,
  p_categoria_movimiento text default null
)
returns table (
  id uuid,
  organization_id uuid,
  tipo_movimiento text,
  categoria_movimiento text,
  cuenta_caja_banco_id uuid,
  cuenta_contrapartida_id uuid,
  cuenta_iva_id uuid,
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
    regla.tipo_movimiento,
    regla.categoria_movimiento,
    regla.cuenta_caja_banco_id,
    regla.cuenta_contrapartida_id,
    regla.cuenta_iva_id,
    regla.requiere_centro_costo,
    regla.prioridad,
    regla.activa,
    regla.metadata,
    regla.created_at,
    regla.updated_at
  from public.reglas_contables_caja regla
  where regla.activa is true
    and regla.tipo_movimiento = p_tipo_movimiento
    and (
      lower(btrim(coalesce(regla.categoria_movimiento, ''))) =
        lower(btrim(coalesce(p_categoria_movimiento, '')))
      or regla.categoria_movimiento is null
    )
    and (
      regla.organization_id = p_organization_id
      or regla.organization_id is null
    )
  order by
    case when regla.organization_id = p_organization_id then 0 else 1 end,
    case
      when lower(btrim(coalesce(regla.categoria_movimiento, ''))) =
        lower(btrim(coalesce(p_categoria_movimiento, ''))) then 0
      else 1
    end,
    regla.prioridad asc,
    regla.created_at asc
  limit 1;
$$;

create or replace function public.validate_cash_account_method(
  p_method public.payment_methods,
  p_fallback_account_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_method.id is null then
    raise exception 'Metodo de caja/banco no encontrado.';
  end if;

  if p_method.type not in ('cash', 'bank', 'card', 'transfer') then
    raise exception 'El metodo seleccionado no representa caja o banco.';
  end if;

  return coalesce(p_method.cuenta_contable_id, p_fallback_account_id);
end;
$$;

create or replace function public.set_cash_movement_accounting_error(
  p_source_type text,
  p_movement_id uuid,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_source_type = 'purchase_payment' then
    update public.purchase_payments
    set estado_contable = 'error',
        contabilizacion_error = p_message
    where id = p_movement_id;
  elsif p_source_type = 'invoice_collection' then
    update public.invoice_collections
    set estado_contable = 'error',
        contabilizacion_error = p_message
    where id = p_movement_id;
  elsif p_source_type = 'cash_bank_transfer' then
    update public.cash_bank_transfers
    set estado_contable = 'error',
        contabilizacion_error = p_message,
        updated_at = now()
    where id = p_movement_id;
  end if;
end;
$$;

create or replace function public.generar_asiento_movimiento_caja(
  p_movimiento_id uuid
)
returns public.asientos_contables
language plpgsql
security definer
set search_path = public
as $$
declare
  target_payment public.purchase_payments%rowtype;
  target_collection public.invoice_collections%rowtype;
  target_transfer public.cash_bank_transfers%rowtype;
  target_purchase public.purchases%rowtype;
  target_invoice public.invoices%rowtype;
  target_rule public.reglas_contables_caja%rowtype;
  existing_asiento public.asientos_contables%rowtype;
  new_asiento public.asientos_contables%rowtype;
  cash_method public.payment_methods%rowtype;
  source_method public.payment_methods%rowtype;
  destination_method public.payment_methods%rowtype;
  cash_account_id uuid;
  source_account_id uuid;
  destination_account_id uuid;
  amount_value numeric;
  movement_date date;
  validation_message text;
begin
  select *
  into target_payment
  from public.purchase_payments
  where id = p_movimiento_id
  for update;

  if target_payment.id is not null then
    if not public.is_internal_org_member(target_payment.organization_id)
      and coalesce(auth.role(), '') <> 'service_role'
    then
      raise exception 'No tienes permisos para contabilizar este movimiento.';
    end if;

    amount_value := greatest(coalesce(target_payment.amount, 0), 0);
    if amount_value <= 0 then
      validation_message := 'El pago no tiene monto suficiente para contabilizar.';
      perform public.set_cash_movement_accounting_error('purchase_payment', target_payment.id, validation_message);
      raise exception '%', validation_message;
    end if;

    select *
    into target_purchase
    from public.purchases
    where id = target_payment.purchase_id;

    if target_purchase.id is null then
      validation_message := 'El pago requiere una compra valida.';
      perform public.set_cash_movement_accounting_error('purchase_payment', target_payment.id, validation_message);
      raise exception '%', validation_message;
    end if;

    if target_payment.asiento_contable_id is not null then
      select *
      into existing_asiento
      from public.asientos_contables
      where id = target_payment.asiento_contable_id
      for update;

      if existing_asiento.id is not null and existing_asiento.estado = 'contabilizado' then
        update public.purchase_payments
        set estado_contable = 'contabilizado',
            contabilizacion_error = null
        where id = target_payment.id;
        return existing_asiento;
      end if;

      if existing_asiento.id is not null and existing_asiento.estado = 'borrador' then
        delete from public.asientos_contables where id = existing_asiento.id;
      end if;
    end if;

    select *
    into target_rule
    from public.obtener_regla_contable_caja(
      target_payment.organization_id,
      'egreso',
      'pago_compra'
    );

    if target_rule.id is null then
      validation_message := 'No existe regla contable activa para pagos de compra.';
      perform public.set_cash_movement_accounting_error('purchase_payment', target_payment.id, validation_message);
      raise exception '%', validation_message;
    end if;

    select *
    into cash_method
    from public.payment_methods
    where id = target_payment.payment_method_id;

    cash_account_id := public.validate_cash_account_method(cash_method, target_rule.cuenta_caja_banco_id);
    movement_date := coalesce(target_payment.payment_date, current_date);

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
      target_payment.organization_id,
      movement_date,
      to_char(movement_date, 'YYYY-MM'),
      'Pago compra ' || coalesce(target_purchase.document_number, target_purchase.supplier_name, target_payment.id::text),
      target_purchase.document_number,
      'caja_chica',
      target_purchase.source_document_id,
      'borrador',
      coalesce(target_purchase.currency, 'CRC'),
      0,
      0,
      auth.uid(),
      jsonb_build_object(
        'source_type', 'purchase_payment',
        'source_cash_movement_id', target_payment.id,
        'source_purchase_id', target_purchase.id,
        'payment_method_id', target_payment.payment_method_id,
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
      documento_origen_id,
      debito,
      credito,
      moneda,
      metadata
    )
    values
      (
        new_asiento.id,
        target_payment.organization_id,
        target_rule.cuenta_contrapartida_id,
        'Pago de cuenta por pagar',
        target_purchase.counterparty_id,
        target_purchase.suggested_cost_center_id,
        target_purchase.source_document_id,
        amount_value,
        0,
        coalesce(target_purchase.currency, 'CRC'),
        jsonb_build_object('movement_id', target_payment.id, 'line_type', 'contrapartida')
      ),
      (
        new_asiento.id,
        target_payment.organization_id,
        cash_account_id,
        'Salida de caja/banco',
        target_purchase.counterparty_id,
        target_purchase.suggested_cost_center_id,
        target_purchase.source_document_id,
        0,
        amount_value,
        coalesce(target_purchase.currency, 'CRC'),
        jsonb_build_object('movement_id', target_payment.id, 'line_type', 'caja_banco')
      );

    perform public.recalcular_totales_asiento(new_asiento.id);

    select * into new_asiento from public.asientos_contables where id = new_asiento.id;

    update public.purchase_payments
    set asiento_contable_id = new_asiento.id,
        estado_contable = 'borrador',
        contabilizacion_error = null
    where id = target_payment.id;

    return new_asiento;
  end if;

  select *
  into target_collection
  from public.invoice_collections
  where id = p_movimiento_id
  for update;

  if target_collection.id is not null then
    if not public.is_internal_org_member(target_collection.organization_id)
      and coalesce(auth.role(), '') <> 'service_role'
    then
      raise exception 'No tienes permisos para contabilizar este movimiento.';
    end if;

    amount_value := greatest(coalesce(target_collection.amount, 0), 0);
    if amount_value <= 0 then
      validation_message := 'El cobro no tiene monto suficiente para contabilizar.';
      perform public.set_cash_movement_accounting_error('invoice_collection', target_collection.id, validation_message);
      raise exception '%', validation_message;
    end if;

    select *
    into target_invoice
    from public.invoices
    where id = target_collection.invoice_id;

    if target_invoice.id is null then
      validation_message := 'El cobro requiere una factura valida.';
      perform public.set_cash_movement_accounting_error('invoice_collection', target_collection.id, validation_message);
      raise exception '%', validation_message;
    end if;

    if target_collection.asiento_contable_id is not null then
      select *
      into existing_asiento
      from public.asientos_contables
      where id = target_collection.asiento_contable_id
      for update;

      if existing_asiento.id is not null and existing_asiento.estado = 'contabilizado' then
        update public.invoice_collections
        set estado_contable = 'contabilizado',
            contabilizacion_error = null
        where id = target_collection.id;
        return existing_asiento;
      end if;

      if existing_asiento.id is not null and existing_asiento.estado = 'borrador' then
        delete from public.asientos_contables where id = existing_asiento.id;
      end if;
    end if;

    select *
    into target_rule
    from public.obtener_regla_contable_caja(
      target_collection.organization_id,
      'ingreso',
      'cobro_factura'
    );

    if target_rule.id is null then
      validation_message := 'No existe regla contable activa para cobros de factura.';
      perform public.set_cash_movement_accounting_error('invoice_collection', target_collection.id, validation_message);
      raise exception '%', validation_message;
    end if;

    select *
    into cash_method
    from public.payment_methods
    where id = target_collection.payment_method_id;

    cash_account_id := public.validate_cash_account_method(cash_method, target_rule.cuenta_caja_banco_id);
    movement_date := coalesce(target_collection.collection_date, current_date);

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
      target_collection.organization_id,
      movement_date,
      to_char(movement_date, 'YYYY-MM'),
      'Cobro factura ' || coalesce(target_invoice.numero_documento, target_invoice.proveedor, target_collection.id::text),
      target_invoice.numero_documento,
      'caja_chica',
      target_invoice.source_document_id,
      'borrador',
      coalesce(target_invoice.moneda, 'CRC'),
      0,
      0,
      auth.uid(),
      jsonb_build_object(
        'source_type', 'invoice_collection',
        'source_cash_movement_id', target_collection.id,
        'source_invoice_id', target_invoice.id,
        'payment_method_id', target_collection.payment_method_id,
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
      documento_origen_id,
      debito,
      credito,
      moneda,
      metadata
    )
    values
      (
        new_asiento.id,
        target_collection.organization_id,
        cash_account_id,
        'Entrada de caja/banco',
        target_invoice.counterparty_id,
        target_invoice.suggested_cost_center_id,
        target_invoice.source_document_id,
        amount_value,
        0,
        coalesce(target_invoice.moneda, 'CRC'),
        jsonb_build_object('movement_id', target_collection.id, 'line_type', 'caja_banco')
      ),
      (
        new_asiento.id,
        target_collection.organization_id,
        target_rule.cuenta_contrapartida_id,
        'Cobro de cuenta por cobrar',
        target_invoice.counterparty_id,
        target_invoice.suggested_cost_center_id,
        target_invoice.source_document_id,
        0,
        amount_value,
        coalesce(target_invoice.moneda, 'CRC'),
        jsonb_build_object('movement_id', target_collection.id, 'line_type', 'contrapartida')
      );

    perform public.recalcular_totales_asiento(new_asiento.id);

    select * into new_asiento from public.asientos_contables where id = new_asiento.id;

    update public.invoice_collections
    set asiento_contable_id = new_asiento.id,
        estado_contable = 'borrador',
        contabilizacion_error = null
    where id = target_collection.id;

    return new_asiento;
  end if;

  select *
  into target_transfer
  from public.cash_bank_transfers
  where id = p_movimiento_id
  for update;

  if target_transfer.id is not null then
    if not public.is_internal_org_member(target_transfer.organization_id)
      and coalesce(auth.role(), '') <> 'service_role'
    then
      raise exception 'No tienes permisos para contabilizar esta transferencia.';
    end if;

    amount_value := greatest(coalesce(target_transfer.amount, 0), 0);
    if amount_value <= 0 then
      validation_message := 'La transferencia no tiene monto suficiente para contabilizar.';
      perform public.set_cash_movement_accounting_error('cash_bank_transfer', target_transfer.id, validation_message);
      raise exception '%', validation_message;
    end if;

    if target_transfer.asiento_contable_id is not null then
      select *
      into existing_asiento
      from public.asientos_contables
      where id = target_transfer.asiento_contable_id
      for update;

      if existing_asiento.id is not null and existing_asiento.estado = 'contabilizado' then
        update public.cash_bank_transfers
        set estado_contable = 'contabilizado',
            contabilizacion_error = null,
            updated_at = now()
        where id = target_transfer.id;
        return existing_asiento;
      end if;

      if existing_asiento.id is not null and existing_asiento.estado = 'borrador' then
        delete from public.asientos_contables where id = existing_asiento.id;
      end if;
    end if;

    select *
    into target_rule
    from public.obtener_regla_contable_caja(
      target_transfer.organization_id,
      'transferencia',
      target_transfer.categoria_movimiento
    );

    if target_rule.id is null then
      validation_message := 'No existe regla contable activa para transferencias.';
      perform public.set_cash_movement_accounting_error('cash_bank_transfer', target_transfer.id, validation_message);
      raise exception '%', validation_message;
    end if;

    select *
    into source_method
    from public.payment_methods
    where id = target_transfer.source_payment_method_id;

    select *
    into destination_method
    from public.payment_methods
    where id = target_transfer.destination_payment_method_id;

    source_account_id := public.validate_cash_account_method(source_method, target_rule.cuenta_contrapartida_id);
    destination_account_id := public.validate_cash_account_method(destination_method, target_rule.cuenta_caja_banco_id);
    movement_date := coalesce(target_transfer.transfer_date, current_date);

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
      target_transfer.organization_id,
      movement_date,
      to_char(movement_date, 'YYYY-MM'),
      'Transferencia caja/banco ' || target_transfer.id::text,
      target_transfer.notes,
      'caja_chica',
      'borrador',
      'CRC',
      0,
      0,
      auth.uid(),
      jsonb_build_object(
        'source_type', 'cash_bank_transfer',
        'source_cash_movement_id', target_transfer.id,
        'source_method_id', target_transfer.source_payment_method_id,
        'destination_method_id', target_transfer.destination_payment_method_id,
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
      debito,
      credito,
      moneda,
      metadata
    )
    values
      (
        new_asiento.id,
        target_transfer.organization_id,
        destination_account_id,
        'Entrada por transferencia',
        amount_value,
        0,
        'CRC',
        jsonb_build_object('movement_id', target_transfer.id, 'line_type', 'destino')
      ),
      (
        new_asiento.id,
        target_transfer.organization_id,
        source_account_id,
        'Salida por transferencia',
        0,
        amount_value,
        'CRC',
        jsonb_build_object('movement_id', target_transfer.id, 'line_type', 'origen')
      );

    perform public.recalcular_totales_asiento(new_asiento.id);

    select * into new_asiento from public.asientos_contables where id = new_asiento.id;

    update public.cash_bank_transfers
    set asiento_contable_id = new_asiento.id,
        estado_contable = 'borrador',
        contabilizacion_error = null,
        updated_at = now()
    where id = target_transfer.id;

    return new_asiento;
  end if;

  raise exception 'Movimiento de caja/banco no encontrado.';
end;
$$;

create or replace function public.revertir_asiento_movimiento_caja(
  p_movimiento_id uuid,
  p_motivo text default 'Reversion contable de movimiento de caja'
)
returns public.asientos_contables
language plpgsql
security definer
set search_path = public
as $$
declare
  target_asiento public.asientos_contables%rowtype;
  target_asiento_id uuid;
  target_organization_id uuid;
  source_type text;
begin
  select asiento_contable_id, organization_id, 'purchase_payment'
  into target_asiento_id, target_organization_id, source_type
  from public.purchase_payments
  where id = p_movimiento_id;

  if not found then
    select asiento_contable_id, organization_id, 'invoice_collection'
    into target_asiento_id, target_organization_id, source_type
    from public.invoice_collections
    where id = p_movimiento_id;
  end if;

  if not found then
    select asiento_contable_id, organization_id, 'cash_bank_transfer'
    into target_asiento_id, target_organization_id, source_type
    from public.cash_bank_transfers
    where id = p_movimiento_id;
  end if;

  if target_organization_id is null then
    raise exception 'Movimiento de caja/banco no encontrado.';
  end if;

  if not public.is_internal_org_member(target_organization_id)
    and coalesce(auth.role(), '') <> 'service_role'
  then
    raise exception 'No tienes permisos para revertir este movimiento.';
  end if;

  if target_asiento_id is null then
    perform public.set_cash_movement_accounting_error(
      source_type,
      p_movimiento_id,
      'El movimiento no tiene asiento contable asociado.'
    );
    raise exception 'El movimiento no tiene asiento contable asociado.';
  end if;

  select *
  into target_asiento
  from public.asientos_contables
  where id = target_asiento_id
  for update;

  if target_asiento.id is null then
    perform public.set_cash_movement_accounting_error(
      source_type,
      p_movimiento_id,
      'El asiento asociado no existe.'
    );
    raise exception 'El asiento asociado no existe.';
  end if;

  if target_asiento.estado <> 'anulado' then
    update public.asientos_contables
    set estado = 'anulado',
        motivo_anulacion = coalesce(nullif(btrim(p_motivo), ''), 'Reversion contable de movimiento de caja'),
        anulado_at = now(),
        anulado_por = auth.uid(),
        updated_at = now()
    where id = target_asiento.id
    returning *
    into target_asiento;
  end if;

  if source_type = 'purchase_payment' then
    update public.purchase_payments
    set estado_contable = 'anulado',
        contabilizacion_error = null
    where id = p_movimiento_id;
  elsif source_type = 'invoice_collection' then
    update public.invoice_collections
    set estado_contable = 'anulado',
        contabilizacion_error = null
    where id = p_movimiento_id;
  elsif source_type = 'cash_bank_transfer' then
    update public.cash_bank_transfers
    set estado_contable = 'anulado',
        contabilizacion_error = null,
        updated_at = now()
    where id = p_movimiento_id;
  end if;

  return target_asiento;
end;
$$;

create or replace function public.sync_cash_movement_accounting_status_from_asiento()
returns trigger
language plpgsql
as $$
declare
  movement_id uuid;
  source_type text;
  next_status text;
begin
  if new.modulo_origen <> 'caja_chica' then
    return new;
  end if;

  source_type := new.metadata ->> 'source_type';
  movement_id := nullif(new.metadata ->> 'source_cash_movement_id', '')::uuid;

  if movement_id is null then
    return new;
  end if;

  next_status := case
    when new.estado = 'contabilizado' then 'contabilizado'
    when new.estado = 'anulado' then 'anulado'
    else 'borrador'
  end;

  if source_type = 'purchase_payment' then
    update public.purchase_payments
    set asiento_contable_id = new.id,
        estado_contable = next_status,
        contabilizacion_error = null
    where id = movement_id;
  elsif source_type = 'invoice_collection' then
    update public.invoice_collections
    set asiento_contable_id = new.id,
        estado_contable = next_status,
        contabilizacion_error = null
    where id = movement_id;
  elsif source_type = 'cash_bank_transfer' then
    update public.cash_bank_transfers
    set asiento_contable_id = new.id,
        estado_contable = next_status,
        contabilizacion_error = null,
        updated_at = now()
    where id = movement_id;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_cash_movement_accounting_status_from_asiento_trigger
on public.asientos_contables;
create trigger sync_cash_movement_accounting_status_from_asiento_trigger
after insert or update of estado
on public.asientos_contables
for each row execute function public.sync_cash_movement_accounting_status_from_asiento();

create or replace function public.block_posted_purchase_payment_accounting_changes()
returns trigger
language plpgsql
as $$
begin
  if old.estado_contable = 'contabilizado'
    and (
      old.organization_id is distinct from new.organization_id
      or old.company_id is distinct from new.company_id
      or old.purchase_id is distinct from new.purchase_id
      or old.payment_method_id is distinct from new.payment_method_id
      or old.amount is distinct from new.amount
      or old.payment_date is distinct from new.payment_date
    )
  then
    raise exception 'El pago ya esta contabilizado. Reverti el asiento antes de modificarlo.';
  end if;

  return new;
end;
$$;

drop trigger if exists block_posted_purchase_payment_accounting_changes_trigger
on public.purchase_payments;
create trigger block_posted_purchase_payment_accounting_changes_trigger
before update on public.purchase_payments
for each row execute function public.block_posted_purchase_payment_accounting_changes();

create or replace function public.block_posted_invoice_collection_accounting_changes()
returns trigger
language plpgsql
as $$
begin
  if old.estado_contable = 'contabilizado'
    and (
      old.organization_id is distinct from new.organization_id
      or old.company_id is distinct from new.company_id
      or old.invoice_id is distinct from new.invoice_id
      or old.payment_method_id is distinct from new.payment_method_id
      or old.amount is distinct from new.amount
      or old.collection_date is distinct from new.collection_date
    )
  then
    raise exception 'El cobro ya esta contabilizado. Reverti el asiento antes de modificarlo.';
  end if;

  return new;
end;
$$;

drop trigger if exists block_posted_invoice_collection_accounting_changes_trigger
on public.invoice_collections;
create trigger block_posted_invoice_collection_accounting_changes_trigger
before update on public.invoice_collections
for each row execute function public.block_posted_invoice_collection_accounting_changes();

create or replace function public.block_posted_cash_bank_transfer_accounting_changes()
returns trigger
language plpgsql
as $$
begin
  if old.estado_contable = 'contabilizado'
    and (
      old.organization_id is distinct from new.organization_id
      or old.company_id is distinct from new.company_id
      or old.source_payment_method_id is distinct from new.source_payment_method_id
      or old.destination_payment_method_id is distinct from new.destination_payment_method_id
      or old.amount is distinct from new.amount
      or old.transfer_date is distinct from new.transfer_date
      or old.categoria_movimiento is distinct from new.categoria_movimiento
    )
  then
    raise exception 'La transferencia ya esta contabilizada. Reverti el asiento antes de modificarla.';
  end if;

  return new;
end;
$$;

drop trigger if exists block_posted_cash_bank_transfer_accounting_changes_trigger
on public.cash_bank_transfers;
create trigger block_posted_cash_bank_transfer_accounting_changes_trigger
before update on public.cash_bank_transfers
for each row execute function public.block_posted_cash_bank_transfer_accounting_changes();

drop trigger if exists set_reglas_contables_caja_updated_at
on public.reglas_contables_caja;
create trigger set_reglas_contables_caja_updated_at
before update on public.reglas_contables_caja
for each row execute function public.set_updated_at();

drop trigger if exists set_cash_bank_transfers_updated_at
on public.cash_bank_transfers;
create trigger set_cash_bank_transfers_updated_at
before update on public.cash_bank_transfers
for each row execute function public.set_updated_at();

alter table public.reglas_contables_caja enable row level security;
alter table public.cash_bank_transfers enable row level security;

drop policy if exists "reglas_contables_caja_select_internal"
on public.reglas_contables_caja;
create policy "reglas_contables_caja_select_internal"
on public.reglas_contables_caja for select
to authenticated
using (
  organization_id is null
  or public.is_internal_org_member(organization_id)
);

drop policy if exists "reglas_contables_caja_insert_internal"
on public.reglas_contables_caja;
create policy "reglas_contables_caja_insert_internal"
on public.reglas_contables_caja for insert
to authenticated
with check (
  organization_id is not null
  and public.is_internal_org_member(organization_id)
);

drop policy if exists "reglas_contables_caja_update_internal"
on public.reglas_contables_caja;
create policy "reglas_contables_caja_update_internal"
on public.reglas_contables_caja for update
to authenticated
using (
  organization_id is not null
  and public.is_internal_org_member(organization_id)
)
with check (
  organization_id is not null
  and public.is_internal_org_member(organization_id)
);

drop policy if exists "cash_bank_transfers_select_internal"
on public.cash_bank_transfers;
create policy "cash_bank_transfers_select_internal"
on public.cash_bank_transfers for select
to authenticated
using (public.is_internal_org_member(organization_id));

drop policy if exists "cash_bank_transfers_insert_internal"
on public.cash_bank_transfers;
create policy "cash_bank_transfers_insert_internal"
on public.cash_bank_transfers for insert
to authenticated
with check (public.is_internal_org_member(organization_id));

drop policy if exists "cash_bank_transfers_update_internal"
on public.cash_bank_transfers;
create policy "cash_bank_transfers_update_internal"
on public.cash_bank_transfers for update
to authenticated
using (public.is_internal_org_member(organization_id))
with check (public.is_internal_org_member(organization_id));

grant execute on function public.obtener_regla_contable_caja(uuid, text, text) to authenticated;
grant execute on function public.generar_asiento_movimiento_caja(uuid) to authenticated;
grant execute on function public.revertir_asiento_movimiento_caja(uuid, text) to authenticated;

with accounts as (
  select
    max(id::text) filter (where codigo = '1.1.1.1')::uuid as caja_id,
    max(id::text) filter (where codigo = '1.1.1.2.1')::uuid as banco_id,
    max(id::text) filter (where codigo = '2.1.1.1')::uuid as proveedores_id,
    max(id::text) filter (where codigo = '1.1.3.1')::uuid as clientes_id
  from public.cuentas_contables
  where organization_id is null
    and codigo in ('1.1.1.1', '1.1.1.2.1', '2.1.1.1', '1.1.3.1')
)
update public.payment_methods method
set cuenta_contable_id = case
  when method.type = 'cash' then accounts.caja_id
  when method.type in ('bank', 'card', 'transfer') then accounts.banco_id
  else method.cuenta_contable_id
end
from accounts
where method.cuenta_contable_id is null
  and (
    (method.type = 'cash' and accounts.caja_id is not null)
    or (method.type in ('bank', 'card', 'transfer') and accounts.banco_id is not null)
  );

with accounts as (
  select
    max(id::text) filter (where codigo = '1.1.1.1')::uuid as caja_id,
    max(id::text) filter (where codigo = '1.1.1.2.1')::uuid as banco_id,
    max(id::text) filter (where codigo = '2.1.1.1')::uuid as proveedores_id,
    max(id::text) filter (where codigo = '1.1.3.1')::uuid as clientes_id
  from public.cuentas_contables
  where organization_id is null
    and codigo in ('1.1.1.1', '1.1.1.2.1', '2.1.1.1', '1.1.3.1')
),
seed_rules as (
  select 'egreso'::text as tipo_movimiento, 'pago_compra'::text as categoria_movimiento,
    accounts.caja_id as cuenta_caja_banco_id,
    accounts.proveedores_id as cuenta_contrapartida_id,
    100 as prioridad
  from accounts
  where accounts.caja_id is not null and accounts.proveedores_id is not null
  union all
  select 'ingreso', 'cobro_factura',
    accounts.caja_id,
    accounts.clientes_id,
    100
  from accounts
  where accounts.caja_id is not null and accounts.clientes_id is not null
  union all
  select 'transferencia', 'transferencia',
    accounts.caja_id,
    accounts.banco_id,
    100
  from accounts
  where accounts.caja_id is not null and accounts.banco_id is not null
  union all
  select 'reintegro', 'reintegro',
    accounts.caja_id,
    accounts.banco_id,
    100
  from accounts
  where accounts.caja_id is not null and accounts.banco_id is not null
)
insert into public.reglas_contables_caja (
  organization_id,
  tipo_movimiento,
  categoria_movimiento,
  cuenta_caja_banco_id,
  cuenta_contrapartida_id,
  prioridad,
  metadata
)
select
  null,
  seed_rules.tipo_movimiento,
  seed_rules.categoria_movimiento,
  seed_rules.cuenta_caja_banco_id,
  seed_rules.cuenta_contrapartida_id,
  seed_rules.prioridad,
  jsonb_build_object('seed', 'schema_032', 'scope', 'global')
from seed_rules
where not exists (
  select 1
  from public.reglas_contables_caja existing
  where existing.organization_id is null
    and existing.tipo_movimiento = seed_rules.tipo_movimiento
    and lower(btrim(coalesce(existing.categoria_movimiento, ''))) =
      lower(btrim(coalesce(seed_rules.categoria_movimiento, '')))
);
