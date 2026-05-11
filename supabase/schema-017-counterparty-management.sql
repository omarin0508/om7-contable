alter table public.counterparties
add column if not exists notes text;

create index if not exists counterparties_org_active_type_idx
on public.counterparties (organization_id, is_active, type);
