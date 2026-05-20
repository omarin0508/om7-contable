-- Workspace de asientos manuales: permite eliminar borradores con RLS.
-- Ejecutar manualmente en Supabase SQL Editor despues de schema-027.

drop policy if exists "asientos_contables_delete_borrador_internal"
on public.asientos_contables;

create policy "asientos_contables_delete_borrador_internal"
on public.asientos_contables for delete
to authenticated
using (
  estado = 'borrador'
  and public.is_internal_org_member(organization_id)
);
