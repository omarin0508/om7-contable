drop function if exists public.validar_regla_contable(uuid, text, uuid, text, text, integer, uuid[]);

alter table public.reglas_contables_compras
add column if not exists updated_at timestamptz not null default now();

alter table public.reglas_contables_facturas
add column if not exists updated_at timestamptz not null default now();

create or replace function public.validar_regla_contable(
  p_organization_id uuid,
  p_modulo text,
  p_regla_id uuid default null,
  p_clave text default null,
  p_clave_secundaria text default null,
  p_prioridad integer default 100,
  p_cuenta_ids uuid[] default array[]::uuid[]
)
returns table (
  valida boolean,
  error text,
  warnings text[],
  conflictos integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  invalid_accounts integer := 0;
  conflict_count integer := 0;
  clean_modulo text := lower(btrim(coalesce(p_modulo, '')));
  clean_clave text := lower(btrim(coalesce(p_clave, '')));
  clean_secundaria text := lower(btrim(coalesce(p_clave_secundaria, '')));
  clean_cuenta_ids uuid[];
begin
  if not public.is_internal_org_member(p_organization_id)
    and coalesce(auth.role(), '') <> 'service_role'
  then
    raise exception 'No tienes permisos para validar reglas contables.';
  end if;

  clean_cuenta_ids := array(
    select distinct cuenta_id
    from unnest(coalesce(p_cuenta_ids, array[]::uuid[])) cuenta_id
    where cuenta_id is not null
  );

  if clean_modulo not in ('compras', 'facturas', 'caja', 'planillas', 'subcontratos') then
    return query select false, 'Modulo de regla contable invalido.', array[]::text[], 0;
    return;
  end if;

  if clean_clave = '' then
    return query select false, 'La categoria o tipo de regla es requerida.', array[]::text[], 0;
    return;
  end if;

  select count(*)::integer
  into invalid_accounts
  from unnest(clean_cuenta_ids) cuenta_id
  left join public.cuentas_contables cuenta on cuenta.id = cuenta_id
  where cuenta.id is null
    or cuenta.tipo_cuenta <> 'detalle'
    or cuenta.permite_movimientos is not true
    or cuenta.activa is not true
    or not (
      cuenta.organization_id = p_organization_id
      or cuenta.organization_id is null
    );

  if invalid_accounts > 0 then
    return query select false, 'Una o mas cuentas no son cuentas detalle activas con movimientos permitidos para esta organizacion.', array[]::text[], 0;
    return;
  end if;

  if clean_modulo = 'compras' then
    select count(*)::integer
    into conflict_count
    from public.reglas_contables_compras regla
    where regla.activa is true
      and regla.id is distinct from p_regla_id
      and regla.organization_id = p_organization_id
      and lower(btrim(regla.categoria_compra)) = clean_clave
      and regla.prioridad = coalesce(p_prioridad, 100);
  elsif clean_modulo = 'facturas' then
    select count(*)::integer
    into conflict_count
    from public.reglas_contables_facturas regla
    where regla.activa is true
      and regla.id is distinct from p_regla_id
      and regla.organization_id = p_organization_id
      and lower(btrim(regla.categoria_factura)) = clean_clave
      and regla.prioridad = coalesce(p_prioridad, 100);
  elsif clean_modulo = 'caja' then
    select count(*)::integer
    into conflict_count
    from public.reglas_contables_caja regla
    where regla.activa is true
      and regla.id is distinct from p_regla_id
      and regla.organization_id = p_organization_id
      and lower(btrim(regla.tipo_movimiento)) = clean_clave
      and lower(btrim(coalesce(regla.categoria_movimiento, ''))) = clean_secundaria
      and regla.prioridad = coalesce(p_prioridad, 100);
  elsif clean_modulo = 'planillas' then
    select count(*)::integer
    into conflict_count
    from public.reglas_contables_planillas regla
    where regla.activa is true
      and regla.id is distinct from p_regla_id
      and regla.organization_id = p_organization_id
      and lower(btrim(regla.tipo_planilla)) = clean_clave
      and lower(btrim(coalesce(regla.clasificacion_laboral, ''))) = clean_secundaria
      and regla.prioridad = coalesce(p_prioridad, 100);
  elsif clean_modulo = 'subcontratos' then
    select count(*)::integer
    into conflict_count
    from public.reglas_contables_subcontratos regla
    where regla.activa is true
      and regla.id is distinct from p_regla_id
      and regla.organization_id = p_organization_id
      and lower(btrim(regla.tipo_subcontrato)) = clean_clave
      and lower(btrim(coalesce(regla.categoria_subcontrato, ''))) = clean_secundaria
      and regla.prioridad = coalesce(p_prioridad, 100);
  end if;

  return query select
    conflict_count = 0,
    case when conflict_count > 0 then 'Existe otra regla activa con la misma categoria/tipo y prioridad.' else null end,
    case
      when conflict_count > 0 then array['Ajusta prioridad o desactiva la regla conflictiva.']::text[]
      else array[]::text[]
    end,
    conflict_count;
end;
$$;

drop trigger if exists set_reglas_contables_compras_updated_at
on public.reglas_contables_compras;
create trigger set_reglas_contables_compras_updated_at
before update on public.reglas_contables_compras
for each row execute function public.set_updated_at();

drop trigger if exists set_reglas_contables_facturas_updated_at
on public.reglas_contables_facturas;
create trigger set_reglas_contables_facturas_updated_at
before update on public.reglas_contables_facturas
for each row execute function public.set_updated_at();

grant execute on function public.validar_regla_contable(uuid, text, uuid, text, text, integer, uuid[]) to authenticated;

notify pgrst, 'reload schema';
