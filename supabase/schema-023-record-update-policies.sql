drop policy if exists "purchases_update_internal" on public.purchases;
create policy "purchases_update_internal"
on public.purchases for update
to authenticated
using (
  public.is_internal_org_member(organization_id)
  and exists (
    select 1
    from public.companies c
    where c.id = purchases.company_id
      and c.organization_id = purchases.organization_id
  )
)
with check (
  public.is_internal_org_member(organization_id)
  and exists (
    select 1
    from public.companies c
    where c.id = purchases.company_id
      and c.organization_id = purchases.organization_id
  )
);

drop policy if exists "invoices_update_internal" on public.invoices;
create policy "invoices_update_internal"
on public.invoices for update
to authenticated
using (
  public.is_internal_org_member(organization_id)
  and exists (
    select 1
    from public.companies c
    where c.id = invoices.company_id
      and c.organization_id = invoices.organization_id
  )
)
with check (
  public.is_internal_org_member(organization_id)
  and exists (
    select 1
    from public.companies c
    where c.id = invoices.company_id
      and c.organization_id = invoices.organization_id
  )
);
