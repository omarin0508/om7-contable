alter table public.purchases
add column if not exists review_status text not null default 'pending';

alter table public.purchases
add column if not exists reviewed_at timestamptz;

alter table public.purchases
add column if not exists reviewed_by uuid references auth.users(id) on delete set null;

alter table public.purchases
add column if not exists review_notes text;

alter table public.purchases
drop constraint if exists purchases_review_status_check;

alter table public.purchases
add constraint purchases_review_status_check
check (review_status in ('pending', 'reviewed', 'approved', 'observed'));

create index if not exists purchases_organization_review_status_idx
on public.purchases (organization_id, review_status);

create index if not exists purchases_reviewed_at_idx
on public.purchases (reviewed_at);

alter table public.invoices
add column if not exists review_status text not null default 'pending';

alter table public.invoices
add column if not exists reviewed_at timestamptz;

alter table public.invoices
add column if not exists reviewed_by uuid references auth.users(id) on delete set null;

alter table public.invoices
add column if not exists review_notes text;

alter table public.invoices
drop constraint if exists invoices_review_status_check;

alter table public.invoices
add constraint invoices_review_status_check
check (review_status in ('pending', 'reviewed', 'approved', 'observed'));

create index if not exists invoices_organization_review_status_idx
on public.invoices (organization_id, review_status);

create index if not exists invoices_reviewed_at_idx
on public.invoices (reviewed_at);
