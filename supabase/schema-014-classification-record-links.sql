-- OM7 Finance OS - Schema 014
-- Referencias de clasificacion usada en compras/facturas.
-- Ejecutar manualmente en Supabase SQL Editor.

alter table public.purchases
add column if not exists classification_id uuid references public.document_classifications(id) on delete set null;

alter table public.purchases
add column if not exists classification_rule_applied text;

alter table public.purchases
add column if not exists classification_confidence numeric(5, 2);

alter table public.purchases
add column if not exists suggested_account text;

alter table public.purchases
add column if not exists suggested_cost_center_id uuid;

alter table public.invoices
add column if not exists classification_id uuid references public.document_classifications(id) on delete set null;

alter table public.invoices
add column if not exists classification_rule_applied text;

alter table public.invoices
add column if not exists classification_confidence numeric(5, 2);

alter table public.invoices
add column if not exists suggested_account text;

alter table public.invoices
add column if not exists suggested_cost_center_id uuid;

create index if not exists purchases_classification_id_idx
on public.purchases (classification_id);

create index if not exists invoices_classification_id_idx
on public.invoices (classification_id);
