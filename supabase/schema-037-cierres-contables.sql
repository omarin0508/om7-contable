drop function if exists public.generar_checklist_cierre_contable(uuid, text, date, date);
drop function if exists public.cerrar_periodo_contable(uuid);
drop function if exists public.reabrir_periodo_contable(uuid, text);
drop function if exists public.marcar_item_cierre(uuid, text);

create table if not exists public.cierres_contables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  periodo text not null,
  fecha_inicio date,
  fecha_fin date,
  estado text not null default 'abierto',
  resumen jsonb not null default '{}'::jsonb,
  cerrado_por uuid,
  cerrado_at timestamptz,
  reabierto_por uuid,
  reabierto_at timestamptz,
  motivo_reapertura text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cierres_contables
drop constraint if exists cierres_contables_periodo_not_blank;

alter table public.cierres_contables
add constraint cierres_contables_periodo_not_blank
check (length(btrim(periodo)) > 0);

alter table public.cierres_contables
drop constraint if exists cierres_contables_estado_check;

alter table public.cierres_contables
add constraint cierres_contables_estado_check
check (estado in ('abierto', 'en_revision', 'cerrado', 'reabierto'));

alter table public.cierres_contables
drop constraint if exists cierres_contables_fechas_check;

alter table public.cierres_contables
add constraint cierres_contables_fechas_check
check (
  fecha_inicio is null
  or fecha_fin is null
  or fecha_fin >= fecha_inicio
);

create unique index if not exists cierres_contables_org_periodo_key
on public.cierres_contables (organization_id, periodo);

create index if not exists cierres_contables_org_estado_idx
on public.cierres_contables (organization_id, estado);

create table if not exists public.cierre_contable_items (
  id uuid primary key default gen_random_uuid(),
  cierre_id uuid not null references public.cierres_contables(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tipo text not null,
  titulo text not null,
  descripcion text not null default '',
  severidad text not null default 'info',
  estado text not null default 'pendiente',
  referencia_tipo text,
  referencia_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  revisado_por uuid,
  revisado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cierre_contable_items
drop constraint if exists cierre_contable_items_tipo_not_blank;

alter table public.cierre_contable_items
add constraint cierre_contable_items_tipo_not_blank
check (length(btrim(tipo)) > 0);

alter table public.cierre_contable_items
drop constraint if exists cierre_contable_items_titulo_not_blank;

alter table public.cierre_contable_items
add constraint cierre_contable_items_titulo_not_blank
check (length(btrim(titulo)) > 0);

alter table public.cierre_contable_items
drop constraint if exists cierre_contable_items_severidad_check;

alter table public.cierre_contable_items
add constraint cierre_contable_items_severidad_check
check (severidad in ('info', 'warning', 'error', 'ok'));

alter table public.cierre_contable_items
drop constraint if exists cierre_contable_items_estado_check;

alter table public.cierre_contable_items
add constraint cierre_contable_items_estado_check
check (estado in ('pendiente', 'revisado', 'resuelto', 'ignorado'));

create index if not exists cierre_contable_items_cierre_idx
on public.cierre_contable_items (cierre_id);

create index if not exists cierre_contable_items_org_estado_idx
on public.cierre_contable_items (organization_id, estado);

create index if not exists cierre_contable_items_severidad_idx
on public.cierre_contable_items (cierre_id, severidad);

create or replace function public.validate_cierre_contable_item_org()
returns trigger
language plpgsql
as $$
declare
  target_organization_id uuid;
begin
  select organization_id
  into target_organization_id
  from public.cierres_contables
  where id = new.cierre_id;

  if target_organization_id is null then
    raise exception 'El cierre contable no existe.';
  end if;

  if target_organization_id <> new.organization_id then
    raise exception 'El item debe pertenecer a la misma organizacion del cierre.';
  end if;

  return new;
end;
$$;

create or replace function public.generar_checklist_cierre_contable(
  p_organization_id uuid,
  p_periodo text,
  p_fecha_inicio date,
  p_fecha_fin date
)
returns public.cierres_contables
language plpgsql
security definer
set search_path = public
as $$
declare
  target_cierre public.cierres_contables%rowtype;
  dashboard record;
  resumen_financiero_json jsonb;
  resumen_flujo_json jsonb;
  balance_comprobacion_json jsonb;
  dashboard_json jsonb;
  resumen_snapshot jsonb;
  total_errores_documentos integer;
begin
  if not public.is_internal_org_member(p_organization_id)
    and coalesce(auth.role(), '') <> 'service_role'
  then
    raise exception 'No tienes permisos para generar este cierre.';
  end if;

  if p_periodo is null or length(btrim(p_periodo)) = 0 then
    raise exception 'El periodo del cierre es requerido.';
  end if;

  if p_fecha_inicio is null or p_fecha_fin is null or p_fecha_fin < p_fecha_inicio then
    raise exception 'El rango de fechas del cierre es invalido.';
  end if;

  select *
  into target_cierre
  from public.cierres_contables
  where organization_id = p_organization_id
    and periodo = btrim(p_periodo)
  for update;

  if target_cierre.id is not null and target_cierre.estado = 'cerrado' then
    raise exception 'El cierre ya esta cerrado. Reabrilo antes de regenerar el checklist.';
  end if;

  if target_cierre.id is null then
    insert into public.cierres_contables (
      organization_id,
      periodo,
      fecha_inicio,
      fecha_fin,
      estado
    )
    values (
      p_organization_id,
      btrim(p_periodo),
      p_fecha_inicio,
      p_fecha_fin,
      'en_revision'
    )
    returning *
    into target_cierre;
  else
    update public.cierres_contables
    set
      fecha_inicio = p_fecha_inicio,
      fecha_fin = p_fecha_fin,
      estado = 'en_revision',
      updated_at = now()
    where id = target_cierre.id
    returning *
    into target_cierre;
  end if;

  select *
  into dashboard
  from public.get_dashboard_contable_ejecutivo(
    p_organization_id,
    p_fecha_inicio,
    p_fecha_fin
  )
  limit 1;

  select coalesce(to_jsonb(row_data), '{}'::jsonb)
  into dashboard_json
  from (
    select *
    from public.get_dashboard_contable_ejecutivo(
      p_organization_id,
      p_fecha_inicio,
      p_fecha_fin
    )
    limit 1
  ) row_data;

  select coalesce(to_jsonb(row_data), '{}'::jsonb)
  into resumen_financiero_json
  from (
    select *
    from public.get_resumen_financiero(
      p_organization_id,
      p_fecha_inicio,
      p_fecha_fin
    )
    limit 1
  ) row_data;

  select coalesce(to_jsonb(row_data), '{}'::jsonb)
  into resumen_flujo_json
  from (
    select *
    from public.get_resumen_flujo_efectivo(
      p_organization_id,
      p_fecha_inicio,
      p_fecha_fin
    )
    limit 1
  ) row_data;

  select jsonb_build_object(
    'total_debito',
    coalesce(max(total_debito_balance), 0),
    'total_credito',
    coalesce(max(total_credito_balance), 0),
    'diferencia',
    coalesce(max(diferencia_balance), 0),
    'lineas',
    count(*)
  )
  into balance_comprobacion_json
  from public.get_balance_comprobacion(
    p_organization_id,
    p_fecha_inicio,
    p_fecha_fin,
    null
  );

  resumen_snapshot := jsonb_build_object(
    'periodo', btrim(p_periodo),
    'fecha_inicio', p_fecha_inicio,
    'fecha_fin', p_fecha_fin,
    'dashboard', coalesce(dashboard_json, '{}'::jsonb),
    'resumen_financiero', coalesce(resumen_financiero_json, '{}'::jsonb),
    'resumen_flujo', coalesce(resumen_flujo_json, '{}'::jsonb),
    'balance_comprobacion', coalesce(balance_comprobacion_json, '{}'::jsonb),
    'bloqueo_definitivo_periodo', false,
    'bloqueo_definitivo_pendiente_fase_futura', true,
    'generado_at', now()
  );

  update public.cierres_contables
  set resumen = resumen_snapshot, updated_at = now()
  where id = target_cierre.id
  returning *
  into target_cierre;

  delete from public.cierre_contable_items
  where cierre_id = target_cierre.id;

  insert into public.cierre_contable_items (
    cierre_id,
    organization_id,
    tipo,
    titulo,
    descripcion,
    severidad,
    metadata
  )
  select
    target_cierre.id,
    p_organization_id,
    alerta.alerta_tipo,
    alerta.titulo,
    alerta.descripcion,
    case
      when alerta.alerta_tipo in ('balance_no_cuadra', 'errores_contabilizacion')
        or alerta.severidad = 'error'
        then 'error'
      when alerta.severidad in ('atencion', 'pendiente')
        then 'warning'
      else 'info'
    end,
    jsonb_build_object(
      'source', 'get_alertas_contables',
      'cantidad', alerta.cantidad,
      'alerta_metadata', alerta.metadata
    )
  from public.get_alertas_contables(
    p_organization_id,
    p_fecha_inicio,
    p_fecha_fin
  ) alerta;

  if coalesce(dashboard.compras_pendientes_contables, 0) > 0 then
    insert into public.cierre_contable_items (
      cierre_id, organization_id, tipo, titulo, descripcion, severidad, metadata
    )
    values (
      target_cierre.id,
      p_organization_id,
      'compras_pendientes',
      'Compras pendientes de contabilizar',
      'Hay compras del periodo sin asiento oficial contabilizado.',
      'warning',
      jsonb_build_object('cantidad', dashboard.compras_pendientes_contables)
    );
  end if;

  if coalesce(dashboard.facturas_pendientes_contables, 0) > 0 then
    insert into public.cierre_contable_items (
      cierre_id, organization_id, tipo, titulo, descripcion, severidad, metadata
    )
    values (
      target_cierre.id,
      p_organization_id,
      'facturas_pendientes',
      'Facturas pendientes de contabilizar',
      'Hay facturas del periodo sin asiento oficial contabilizado.',
      'warning',
      jsonb_build_object('cantidad', dashboard.facturas_pendientes_contables)
    );
  end if;

  if coalesce(dashboard.caja_pendiente_contable, 0) > 0 then
    insert into public.cierre_contable_items (
      cierre_id, organization_id, tipo, titulo, descripcion, severidad, metadata
    )
    values (
      target_cierre.id,
      p_organization_id,
      'caja_pendiente',
      'Caja/Bancos pendientes',
      'Hay cobros, pagos o transferencias del periodo sin asiento oficial.',
      'warning',
      jsonb_build_object('cantidad', dashboard.caja_pendiente_contable)
    );
  end if;

  if coalesce(dashboard.planillas_pendientes_contables, 0) > 0 then
    insert into public.cierre_contable_items (
      cierre_id, organization_id, tipo, titulo, descripcion, severidad, metadata
    )
    values (
      target_cierre.id,
      p_organization_id,
      'planillas_pendientes',
      'Planillas pendientes',
      'Hay planillas del periodo sin asiento oficial contabilizado.',
      'warning',
      jsonb_build_object('cantidad', dashboard.planillas_pendientes_contables)
    );
  end if;

  if coalesce(dashboard.subcontratos_pendientes_contables, 0) > 0 then
    insert into public.cierre_contable_items (
      cierre_id, organization_id, tipo, titulo, descripcion, severidad, metadata
    )
    values (
      target_cierre.id,
      p_organization_id,
      'subcontratos_pendientes',
      'Subcontratos pendientes',
      'Hay pagos de subcontratos del periodo sin asiento oficial contabilizado.',
      'warning',
      jsonb_build_object('cantidad', dashboard.subcontratos_pendientes_contables)
    );
  end if;

  total_errores_documentos :=
    coalesce(dashboard.compras_errores_contables, 0)
    + coalesce(dashboard.facturas_errores_contables, 0)
    + coalesce(dashboard.caja_errores_contable, 0)
    + coalesce(dashboard.planillas_errores_contables, 0)
    + coalesce(dashboard.subcontratos_errores_contables, 0);

  if total_errores_documentos > 0 then
    insert into public.cierre_contable_items (
      cierre_id, organization_id, tipo, titulo, descripcion, severidad, metadata
    )
    values (
      target_cierre.id,
      p_organization_id,
      'documentos_error_contable',
      'Documentos con error contable',
      'Hay documentos operativos con estado_contable = error.',
      'error',
      jsonb_build_object('cantidad', total_errores_documentos)
    );
  end if;

  insert into public.cierre_contable_items (
    cierre_id,
    organization_id,
    tipo,
    titulo,
    descripcion,
    severidad,
    metadata
  )
  values
    (
      target_cierre.id,
      p_organization_id,
      'exportar_balance_general',
      'Exportar Balance General',
      'Generar y archivar el Balance General del periodo desde reportes oficiales.',
      'info',
      jsonb_build_object('reporte', 'balance-general')
    ),
    (
      target_cierre.id,
      p_organization_id,
      'exportar_estado_resultados',
      'Exportar Estado de Resultados',
      'Generar y archivar el Estado de Resultados del periodo desde reportes oficiales.',
      'info',
      jsonb_build_object('reporte', 'estado-resultados')
    ),
    (
      target_cierre.id,
      p_organization_id,
      'exportar_flujo_efectivo',
      'Exportar Flujo de Efectivo',
      'Generar y archivar el Flujo de Efectivo del periodo desde reportes oficiales.',
      'info',
      jsonb_build_object('reporte', 'flujo-efectivo')
    ),
    (
      target_cierre.id,
      p_organization_id,
      'revision_utilidad_neta',
      'Revision final de utilidad neta',
      'Confirmar utilidad neta, balance y flujo contra el paquete financiero antes del cierre.',
      'warning',
      jsonb_build_object(
        'utilidad_neta',
        coalesce(dashboard.utilidad_neta, 0),
        'balance_cuadra',
        coalesce(dashboard.balance_cuadra, false)
      )
    );

  return target_cierre;
end;
$$;

create or replace function public.marcar_item_cierre(
  p_item_id uuid,
  p_estado text
)
returns public.cierre_contable_items
language plpgsql
security definer
set search_path = public
as $$
declare
  target_item public.cierre_contable_items%rowtype;
  target_cierre public.cierres_contables%rowtype;
begin
  if p_estado not in ('pendiente', 'revisado', 'resuelto', 'ignorado') then
    raise exception 'Estado de item invalido.';
  end if;

  select *
  into target_item
  from public.cierre_contable_items
  where id = p_item_id
  for update;

  if target_item.id is null then
    raise exception 'Item de cierre no encontrado.';
  end if;

  if not public.is_internal_org_member(target_item.organization_id)
    and coalesce(auth.role(), '') <> 'service_role'
  then
    raise exception 'No tienes permisos para actualizar este item.';
  end if;

  select *
  into target_cierre
  from public.cierres_contables
  where id = target_item.cierre_id
  for update;

  if target_cierre.estado = 'cerrado' then
    raise exception 'No se pueden modificar items de un cierre cerrado.';
  end if;

  update public.cierre_contable_items
  set
    estado = p_estado,
    revisado_por = auth.uid(),
    revisado_at = case when p_estado = 'pendiente' then null else now() end,
    updated_at = now()
  where id = target_item.id
  returning *
  into target_item;

  return target_item;
end;
$$;

create or replace function public.cerrar_periodo_contable(p_cierre_id uuid)
returns public.cierres_contables
language plpgsql
security definer
set search_path = public
as $$
declare
  target_cierre public.cierres_contables%rowtype;
  pending_errors integer;
  pending_warnings integer;
  ignored_warnings_without_reason integer;
  resumen_financiero_json jsonb;
  resumen_flujo_json jsonb;
  dashboard_json jsonb;
begin
  select *
  into target_cierre
  from public.cierres_contables
  where id = p_cierre_id
  for update;

  if target_cierre.id is null then
    raise exception 'Cierre contable no encontrado.';
  end if;

  if not public.is_internal_org_member(target_cierre.organization_id)
    and coalesce(auth.role(), '') <> 'service_role'
  then
    raise exception 'No tienes permisos para cerrar este periodo.';
  end if;

  if target_cierre.estado = 'cerrado' then
    return target_cierre;
  end if;

  select count(*)::integer
  into pending_errors
  from public.cierre_contable_items
  where cierre_id = target_cierre.id
    and severidad = 'error'
    and estado = 'pendiente';

  if pending_errors > 0 then
    raise exception 'No se puede cerrar el periodo: existen items de error pendientes.';
  end if;

  select count(*)::integer
  into pending_warnings
  from public.cierre_contable_items
  where cierre_id = target_cierre.id
    and severidad = 'warning'
    and estado = 'pendiente';

  if pending_warnings > 0 then
    raise exception 'No se puede cerrar el periodo: existen advertencias pendientes.';
  end if;

  select count(*)::integer
  into ignored_warnings_without_reason
  from public.cierre_contable_items
  where cierre_id = target_cierre.id
    and severidad = 'warning'
    and estado = 'ignorado'
    and length(btrim(coalesce(metadata ->> 'motivo_ignorado', ''))) = 0;

  if ignored_warnings_without_reason > 0 then
    raise exception 'No se puede cerrar el periodo: las advertencias ignoradas requieren motivo.';
  end if;

  select coalesce(to_jsonb(row_data), '{}'::jsonb)
  into dashboard_json
  from (
    select *
    from public.get_dashboard_contable_ejecutivo(
      target_cierre.organization_id,
      target_cierre.fecha_inicio,
      target_cierre.fecha_fin
    )
    limit 1
  ) row_data;

  select coalesce(to_jsonb(row_data), '{}'::jsonb)
  into resumen_financiero_json
  from (
    select *
    from public.get_resumen_financiero(
      target_cierre.organization_id,
      target_cierre.fecha_inicio,
      target_cierre.fecha_fin
    )
    limit 1
  ) row_data;

  select coalesce(to_jsonb(row_data), '{}'::jsonb)
  into resumen_flujo_json
  from (
    select *
    from public.get_resumen_flujo_efectivo(
      target_cierre.organization_id,
      target_cierre.fecha_inicio,
      target_cierre.fecha_fin
    )
    limit 1
  ) row_data;

  update public.cierres_contables
  set
    estado = 'cerrado',
    resumen = coalesce(target_cierre.resumen, '{}'::jsonb)
      || jsonb_build_object(
        'dashboard_cierre', coalesce(dashboard_json, '{}'::jsonb),
        'resumen_financiero_cierre', coalesce(resumen_financiero_json, '{}'::jsonb),
        'resumen_flujo_cierre', coalesce(resumen_flujo_json, '{}'::jsonb),
        'cerrado_at', now(),
        'bloqueo_definitivo_periodo', false,
        'bloqueo_definitivo_pendiente_fase_futura', true
      ),
    cerrado_por = auth.uid(),
    cerrado_at = now(),
    updated_at = now()
  where id = target_cierre.id
  returning *
  into target_cierre;

  return target_cierre;
end;
$$;

create or replace function public.reabrir_periodo_contable(
  p_cierre_id uuid,
  p_motivo text
)
returns public.cierres_contables
language plpgsql
security definer
set search_path = public
as $$
declare
  target_cierre public.cierres_contables%rowtype;
begin
  if p_motivo is null or length(btrim(p_motivo)) = 0 then
    raise exception 'El motivo de reapertura es requerido.';
  end if;

  select *
  into target_cierre
  from public.cierres_contables
  where id = p_cierre_id
  for update;

  if target_cierre.id is null then
    raise exception 'Cierre contable no encontrado.';
  end if;

  if not public.is_internal_org_member(target_cierre.organization_id)
    and coalesce(auth.role(), '') <> 'service_role'
  then
    raise exception 'No tienes permisos para reabrir este periodo.';
  end if;

  update public.cierres_contables
  set
    estado = 'reabierto',
    reabierto_por = auth.uid(),
    reabierto_at = now(),
    motivo_reapertura = btrim(p_motivo),
    updated_at = now()
  where id = target_cierre.id
  returning *
  into target_cierre;

  return target_cierre;
end;
$$;

drop trigger if exists validate_cierre_contable_item_org_trigger
on public.cierre_contable_items;
create trigger validate_cierre_contable_item_org_trigger
before insert or update
on public.cierre_contable_items
for each row execute function public.validate_cierre_contable_item_org();

drop trigger if exists set_cierres_contables_updated_at
on public.cierres_contables;
create trigger set_cierres_contables_updated_at
before update on public.cierres_contables
for each row execute function public.set_updated_at();

drop trigger if exists set_cierre_contable_items_updated_at
on public.cierre_contable_items;
create trigger set_cierre_contable_items_updated_at
before update on public.cierre_contable_items
for each row execute function public.set_updated_at();

alter table public.cierres_contables enable row level security;
alter table public.cierre_contable_items enable row level security;

drop policy if exists "cierres_contables_select_internal"
on public.cierres_contables;
create policy "cierres_contables_select_internal"
on public.cierres_contables for select
to authenticated
using (public.is_internal_org_member(organization_id));

drop policy if exists "cierres_contables_insert_internal"
on public.cierres_contables;
create policy "cierres_contables_insert_internal"
on public.cierres_contables for insert
to authenticated
with check (public.is_internal_org_member(organization_id));

drop policy if exists "cierres_contables_update_internal"
on public.cierres_contables;
create policy "cierres_contables_update_internal"
on public.cierres_contables for update
to authenticated
using (public.is_internal_org_member(organization_id))
with check (public.is_internal_org_member(organization_id));

drop policy if exists "cierre_contable_items_select_internal"
on public.cierre_contable_items;
create policy "cierre_contable_items_select_internal"
on public.cierre_contable_items for select
to authenticated
using (public.is_internal_org_member(organization_id));

drop policy if exists "cierre_contable_items_insert_internal"
on public.cierre_contable_items;
create policy "cierre_contable_items_insert_internal"
on public.cierre_contable_items for insert
to authenticated
with check (public.is_internal_org_member(organization_id));

drop policy if exists "cierre_contable_items_update_internal"
on public.cierre_contable_items;
create policy "cierre_contable_items_update_internal"
on public.cierre_contable_items for update
to authenticated
using (public.is_internal_org_member(organization_id))
with check (public.is_internal_org_member(organization_id));

grant execute on function public.generar_checklist_cierre_contable(uuid, text, date, date) to authenticated;
grant execute on function public.cerrar_periodo_contable(uuid) to authenticated;
grant execute on function public.reabrir_periodo_contable(uuid, text) to authenticated;
grant execute on function public.marcar_item_cierre(uuid, text) to authenticated;
