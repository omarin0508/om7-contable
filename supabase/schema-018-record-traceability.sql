alter table public.purchases
add column if not exists source_document_id uuid references public.documents(id) on delete set null;

alter table public.purchases
add column if not exists source_extraction_id uuid references public.document_extractions(id) on delete set null;

alter table public.purchases
add column if not exists conversion_metadata jsonb;

alter table public.invoices
add column if not exists source_document_id uuid references public.documents(id) on delete set null;

alter table public.invoices
add column if not exists source_extraction_id uuid references public.document_extractions(id) on delete set null;

alter table public.invoices
add column if not exists conversion_metadata jsonb;

create index if not exists purchases_source_document_id_idx
on public.purchases (source_document_id);

create index if not exists purchases_source_extraction_id_idx
on public.purchases (source_extraction_id);

create index if not exists invoices_source_document_id_idx
on public.invoices (source_document_id);

create index if not exists invoices_source_extraction_id_idx
on public.invoices (source_extraction_id);
