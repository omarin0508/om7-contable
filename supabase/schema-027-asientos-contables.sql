create table if not exists public.asientos_contables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  fecha date not null,
  periodo text,
  numero_asiento bigint not null,
  descripcion text not null,
  referencia text,
  modulo_origen text,
  documento_origen_id uuid,
  estado text not null default 'borrador',
  moneda text not null default 'CRC',
  tipo_cambio numeric,
  total_debito numeric not null default 0,
  total_credito numeric not null default 0,
  creado_por uuid references auth.users(id) on delete set null,
  contabilizado_por uuid references auth.users(id) on delete set null,
  contabilizado_at timestamptz,
  anulado_por uuid references auth.users(id) on delete set null,
  anulado_at timestamptz,
  motivo_anulacion text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.asientos_contables
drop constraint if exists asientos_contables_estado_check;

alter table public.asientos_contables
add constraint asientos_contables_estado_check
check (estado in ('borrador', 'contabilizado', 'anulado'));

alter table public.asientos_contables
drop constraint if exists asientos_contables_modulo_origen_check;

alter table public.asientos_contables
add constraint asientos_contables_modulo_origen_check
check (
  modulo_origen is null
  or modulo_origen in (
    'manual',
    'compras',
    'facturas',
    'caja_chica',
    'planillas',
    'subcontratos',
    'ajustes'
  )
);

alter table public.asientos_contables
drop constraint if exists asientos_contables_totales_check;

alter table public.asientos_contables
add constraint asientos_contables_totales_check
check (total_debito >= 0 and total_credito >= 0);

alter table public.asientos_contables
drop constraint if exists asientos_contables_descripcion_not_blank;

alter table public.asientos_contables
add constraint asientos_contables_descripcion_not_blank
check (length(btrim(descripcion)) > 0);

create unique index if not exists asientos_contables_organization_numero_key
on public.asientos_contables (organization_id, numero_asiento);

create index if not exists asientos_contables_organization_idx
on public.asientos_contables (organization_id);

create index if not exists asientos_contables_fecha_idx
on public.asientos_contables (fecha);

create index if not exists asientos_contables_estado_idx
on public.asientos_contables (estado);

create index if not exists asientos_contables_modulo_origen_idx
on public.asientos_contables (modulo_origen);

create index if not exists asientos_contables_documento_origen_idx
on public.asientos_contables (documento_origen_id);

create table if not exists public.asiento_lineas (
  id uuid primary key default gen_random_uuid(),
  asiento_id uuid not null references public.asientos_contables(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cuenta_contable_id uuid not null references public.cuentas_contables(id) on delete restrict,
  descripcion text,
  tercero_id uuid,
  centro_costo_id uuid,
  presupuesto_id uuid,
  documento_origen_id uuid,
  debito numeric not null default 0,
  credito numeric not null default 0,
  moneda text not null default 'CRC',
  tipo_cambio numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.asiento_lineas
drop constraint if exists asiento_lineas_debito_credito_check;

alter table public.asiento_lineas
add constraint asiento_lineas_debito_credito_check
check (
  debito >= 0
  and credito >= 0
  and (
    (debito > 0 and credito = 0)
    or (credito > 0 and debito = 0)
  )
);

create index if not exists asiento_lineas_asiento_idx
on public.asiento_lineas (asiento_id);

create index if not exists asiento_lineas_cuenta_contable_idx
on public.asiento_lineas (cuenta_contable_id);

create index if not exists asiento_lineas_centro_costo_idx
on public.asiento_lineas (centro_costo_id);

create index if not exists asiento_lineas_presupuesto_idx
on public.asiento_lineas (presupuesto_id);

create or replace function public.set_asiento_numero()
returns trigger
language plpgsql
as $$
begin
  if new.numero_asiento is not null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text, 0));

  select coalesce(max(numero_asiento), 0) + 1
  into new.numero_asiento
  from public.asientos_contables
  where organization_id = new.organization_id;

  return new;
end;
$$;

create or replace function public.recalcular_totales_asiento(p_asiento_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.asientos_contables asiento
  set
    total_debito = coalesce(totals.total_debito, 0),
    total_credito = coalesce(totals.total_credito, 0),
    updated_at = now()
  from (
    select
      coalesce(sum(debito), 0) as total_debito,
      coalesce(sum(credito), 0) as total_credito
    from public.asiento_lineas
    where asiento_id = p_asiento_id
  ) totals
  where asiento.id = p_asiento_id;
end;
$$;

create or replace function public.sync_asiento_totales_from_lineas()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalcular_totales_asiento(old.asiento_id);
    return old;
  end if;

  perform public.recalcular_totales_asiento(new.asiento_id);

  if tg_op = 'UPDATE' and old.asiento_id <> new.asiento_id then
    perform public.recalcular_totales_asiento(old.asiento_id);
  end if;

  return new;
end;
$$;

create or replace function public.validate_asiento_linea()
returns trigger
language plpgsql
as $$
declare
  target_asiento public.asientos_contables%rowtype;
  target_cuenta public.cuentas_contables%rowtype;
begin
  select *
  into target_asiento
  from public.asientos_contables
  where id = new.asiento_id;

  if target_asiento.id is null then
    raise exception 'El asiento no existe.';
  end if;

  if target_asiento.estado <> 'borrador' then
    raise exception 'No se pueden modificar lineas de un asiento contabilizado o anulado.';
  end if;

  if new.organization_id <> target_asiento.organization_id then
    raise exception 'La linea debe pertenecer a la misma organizacion del asiento.';
  end if;

  select *
  into target_cuenta
  from public.cuentas_contables
  where id = new.cuenta_contable_id;

  if target_cuenta.id is null then
    raise exception 'La cuenta contable no existe.';
  end if;

  if target_cuenta.organization_id is not null
    and target_cuenta.organization_id <> new.organization_id
  then
    raise exception 'La cuenta contable debe ser global o pertenecer a la misma organizacion.';
  end if;

  if target_cuenta.tipo_cuenta <> 'detalle'
    or target_cuenta.permite_movimientos is not true
  then
    raise exception 'Solo cuentas detalle con movimientos permitidos pueden usarse en lineas.';
  end if;

  if target_cuenta.activa is not true then
    raise exception 'La cuenta contable esta inactiva.';
  end if;

  return new;
end;
$$;

create or replace function public.validate_delete_asiento_linea()
returns trigger
language plpgsql
as $$
declare
  target_estado text;
begin
  select estado
  into target_estado
  from public.asientos_contables
  where id = old.asiento_id;

  if target_estado <> 'borrador' then
    raise exception 'No se pueden eliminar lineas de un asiento contabilizado o anulado.';
  end if;

  return old;
end;
$$;

create or replace function public.contabilizar_asiento(p_asiento_id uuid)
returns public.asientos_contables
language plpgsql
security definer
set search_path = public
as $$
declare
  target_asiento public.asientos_contables%rowtype;
  invalid_lines integer;
begin
  select *
  into target_asiento
  from public.asientos_contables
  where id = p_asiento_id
  for update;

  if target_asiento.id is null then
    raise exception 'Asiento no encontrado.';
  end if;

  if not public.is_internal_org_member(target_asiento.organization_id)
    and coalesce(auth.role(), '') <> 'service_role'
  then
    raise exception 'No tienes permisos para contabilizar este asiento.';
  end if;

  if target_asiento.estado = 'contabilizado' then
    return target_asiento;
  end if;

  if target_asiento.estado = 'anulado' then
    raise exception 'No se puede contabilizar un asiento anulado.';
  end if;

  perform public.recalcular_totales_asiento(p_asiento_id);

  select *
  into target_asiento
  from public.asientos_contables
  where id = p_asiento_id
  for update;

  select count(*)
  into invalid_lines
  from public.asiento_lineas linea
  join public.cuentas_contables cuenta on cuenta.id = linea.cuenta_contable_id
  where linea.asiento_id = p_asiento_id
    and (
      linea.organization_id <> target_asiento.organization_id
      or cuenta.activa is not true
      or cuenta.tipo_cuenta <> 'detalle'
      or cuenta.permite_movimientos is not true
      or (
        cuenta.organization_id is not null
        and cuenta.organization_id <> target_asiento.organization_id
      )
    );

  if invalid_lines > 0 then
    raise exception 'El asiento tiene lineas con cuentas invalidas.';
  end if;

  if target_asiento.total_debito <= 0 then
    raise exception 'El asiento debe tener monto mayor a cero.';
  end if;

  if abs(target_asiento.total_debito - target_asiento.total_credito) > 0.004 then
    raise exception 'El asiento debe estar balanceado antes de contabilizar.';
  end if;

  update public.asientos_contables
  set
    estado = 'contabilizado',
    contabilizado_at = now(),
    contabilizado_por = auth.uid(),
    updated_at = now()
  where id = p_asiento_id
  returning *
  into target_asiento;

  return target_asiento;
end;
$$;

create or replace function public.anular_asiento(
  p_asiento_id uuid,
  p_motivo text
)
returns public.asientos_contables
language plpgsql
security definer
set search_path = public
as $$
declare
  target_asiento public.asientos_contables%rowtype;
begin
  select *
  into target_asiento
  from public.asientos_contables
  where id = p_asiento_id
  for update;

  if target_asiento.id is null then
    raise exception 'Asiento no encontrado.';
  end if;

  if not public.is_internal_org_member(target_asiento.organization_id)
    and coalesce(auth.role(), '') <> 'service_role'
  then
    raise exception 'No tienes permisos para anular este asiento.';
  end if;

  if target_asiento.estado = 'anulado' then
    return target_asiento;
  end if;

  if length(btrim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'Debes indicar un motivo de anulacion.';
  end if;

  update public.asientos_contables
  set
    estado = 'anulado',
    motivo_anulacion = p_motivo,
    anulado_at = now(),
    anulado_por = auth.uid(),
    updated_at = now()
  where id = p_asiento_id
  returning *
  into target_asiento;

  return target_asiento;
end;
$$;

drop trigger if exists set_asiento_numero_trigger
on public.asientos_contables;
create trigger set_asiento_numero_trigger
before insert on public.asientos_contables
for each row execute function public.set_asiento_numero();

drop trigger if exists set_asientos_contables_updated_at
on public.asientos_contables;
create trigger set_asientos_contables_updated_at
before update on public.asientos_contables
for each row execute function public.set_updated_at();

drop trigger if exists validate_asiento_linea_trigger
on public.asiento_lineas;
create trigger validate_asiento_linea_trigger
before insert or update on public.asiento_lineas
for each row execute function public.validate_asiento_linea();

drop trigger if exists validate_delete_asiento_linea_trigger
on public.asiento_lineas;
create trigger validate_delete_asiento_linea_trigger
before delete on public.asiento_lineas
for each row execute function public.validate_delete_asiento_linea();

drop trigger if exists sync_asiento_totales_from_lineas_trigger
on public.asiento_lineas;
create trigger sync_asiento_totales_from_lineas_trigger
after insert or update or delete on public.asiento_lineas
for each row execute function public.sync_asiento_totales_from_lineas();

alter table public.asientos_contables enable row level security;
alter table public.asiento_lineas enable row level security;

drop policy if exists "asientos_contables_select_internal"
on public.asientos_contables;
create policy "asientos_contables_select_internal"
on public.asientos_contables for select
to authenticated
using (public.is_internal_org_member(organization_id));

drop policy if exists "asientos_contables_insert_internal"
on public.asientos_contables;
create policy "asientos_contables_insert_internal"
on public.asientos_contables for insert
to authenticated
with check (
  estado = 'borrador'
  and public.is_internal_org_member(organization_id)
);

drop policy if exists "asientos_contables_update_borrador_internal"
on public.asientos_contables;
create policy "asientos_contables_update_borrador_internal"
on public.asientos_contables for update
to authenticated
using (
  estado = 'borrador'
  and public.is_internal_org_member(organization_id)
)
with check (
  estado = 'borrador'
  and public.is_internal_org_member(organization_id)
);

drop policy if exists "asiento_lineas_select_internal"
on public.asiento_lineas;
create policy "asiento_lineas_select_internal"
on public.asiento_lineas for select
to authenticated
using (public.is_internal_org_member(organization_id));

drop policy if exists "asiento_lineas_insert_internal"
on public.asiento_lineas;
create policy "asiento_lineas_insert_internal"
on public.asiento_lineas for insert
to authenticated
with check (
  public.is_internal_org_member(organization_id)
  and exists (
    select 1
    from public.asientos_contables asiento
    where asiento.id = asiento_lineas.asiento_id
      and asiento.organization_id = asiento_lineas.organization_id
      and asiento.estado = 'borrador'
  )
);

drop policy if exists "asiento_lineas_update_internal"
on public.asiento_lineas;
create policy "asiento_lineas_update_internal"
on public.asiento_lineas for update
to authenticated
using (
  public.is_internal_org_member(organization_id)
  and exists (
    select 1
    from public.asientos_contables asiento
    where asiento.id = asiento_lineas.asiento_id
      and asiento.organization_id = asiento_lineas.organization_id
      and asiento.estado = 'borrador'
  )
)
with check (
  public.is_internal_org_member(organization_id)
  and exists (
    select 1
    from public.asientos_contables asiento
    where asiento.id = asiento_lineas.asiento_id
      and asiento.organization_id = asiento_lineas.organization_id
      and asiento.estado = 'borrador'
  )
);

drop policy if exists "asiento_lineas_delete_internal"
on public.asiento_lineas;
create policy "asiento_lineas_delete_internal"
on public.asiento_lineas for delete
to authenticated
using (
  public.is_internal_org_member(organization_id)
  and exists (
    select 1
    from public.asientos_contables asiento
    where asiento.id = asiento_lineas.asiento_id
      and asiento.organization_id = asiento_lineas.organization_id
      and asiento.estado = 'borrador'
  )
);

grant execute on function public.contabilizar_asiento(uuid) to authenticated;
grant execute on function public.anular_asiento(uuid, text) to authenticated;
