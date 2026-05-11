create table if not exists public.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  period_year int not null,
  period_month int not null,
  status text not null default 'open',
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.accounting_periods
drop constraint if exists accounting_periods_month_check;

alter table public.accounting_periods
add constraint accounting_periods_month_check
check (period_month between 1 and 12);

alter table public.accounting_periods
drop constraint if exists accounting_periods_status_check;

alter table public.accounting_periods
add constraint accounting_periods_status_check
check (status in ('open', 'in_review', 'closed'));

create unique index if not exists accounting_periods_company_month_key
on public.accounting_periods (
  organization_id,
  company_id,
  period_year,
  period_month
);

create index if not exists accounting_periods_company_status_idx
on public.accounting_periods (
  organization_id,
  company_id,
  status,
  period_year,
  period_month
);

drop trigger if exists set_accounting_periods_updated_at on public.accounting_periods;
create trigger set_accounting_periods_updated_at
before update on public.accounting_periods
for each row execute function public.set_updated_at();

alter table public.accounting_periods enable row level security;

drop policy if exists "accounting_periods_select_internal" on public.accounting_periods;
create policy "accounting_periods_select_internal"
on public.accounting_periods for select
to authenticated
using (public.is_internal_org_member(organization_id));

drop policy if exists "accounting_periods_insert_internal" on public.accounting_periods;
create policy "accounting_periods_insert_internal"
on public.accounting_periods for insert
to authenticated
with check (public.is_internal_org_member(organization_id));

drop policy if exists "accounting_periods_update_internal" on public.accounting_periods;
create policy "accounting_periods_update_internal"
on public.accounting_periods for update
to authenticated
using (public.is_internal_org_member(organization_id))
with check (public.is_internal_org_member(organization_id));
