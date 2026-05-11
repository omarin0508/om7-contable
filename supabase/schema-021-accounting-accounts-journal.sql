create table if not exists public.accounting_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  type text not null,
  normal_balance text not null,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

alter table public.accounting_accounts
drop constraint if exists accounting_accounts_type_check;

alter table public.accounting_accounts
add constraint accounting_accounts_type_check
check (type in ('asset', 'liability', 'equity', 'income', 'expense', 'tax', 'bank', 'cash'));

alter table public.accounting_accounts
drop constraint if exists accounting_accounts_normal_balance_check;

alter table public.accounting_accounts
add constraint accounting_accounts_normal_balance_check
check (normal_balance in ('debit', 'credit'));

create unique index if not exists accounting_accounts_company_code_key
on public.accounting_accounts (organization_id, company_id, code);

create index if not exists accounting_accounts_company_active_idx
on public.accounting_accounts (organization_id, company_id, is_active, type);

alter table public.accounting_accounts enable row level security;

drop policy if exists "accounting_accounts_select_internal" on public.accounting_accounts;
create policy "accounting_accounts_select_internal"
on public.accounting_accounts for select
to authenticated
using (public.is_internal_org_member(organization_id));

drop policy if exists "accounting_accounts_insert_internal" on public.accounting_accounts;
create policy "accounting_accounts_insert_internal"
on public.accounting_accounts for insert
to authenticated
with check (public.is_internal_org_member(organization_id));

drop policy if exists "accounting_accounts_update_internal" on public.accounting_accounts;
create policy "accounting_accounts_update_internal"
on public.accounting_accounts for update
to authenticated
using (public.is_internal_org_member(organization_id))
with check (public.is_internal_org_member(organization_id));

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  period_year int not null,
  period_month int not null,
  source_type text not null,
  source_id uuid not null,
  status text not null default 'suggested',
  explanation text,
  created_at timestamptz default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null
);

alter table public.journal_entries
drop constraint if exists journal_entries_source_type_check;

alter table public.journal_entries
add constraint journal_entries_source_type_check
check (source_type in ('purchase', 'invoice'));

alter table public.journal_entries
drop constraint if exists journal_entries_status_check;

alter table public.journal_entries
add constraint journal_entries_status_check
check (status in ('suggested', 'reviewed', 'posted', 'observed'));

create unique index if not exists journal_entries_source_key
on public.journal_entries (organization_id, company_id, source_type, source_id);

create index if not exists journal_entries_company_period_status_idx
on public.journal_entries (organization_id, company_id, period_year, period_month, status);

alter table public.journal_entries enable row level security;

drop policy if exists "journal_entries_select_internal" on public.journal_entries;
create policy "journal_entries_select_internal"
on public.journal_entries for select
to authenticated
using (public.is_internal_org_member(organization_id));

drop policy if exists "journal_entries_insert_internal" on public.journal_entries;
create policy "journal_entries_insert_internal"
on public.journal_entries for insert
to authenticated
with check (public.is_internal_org_member(organization_id));

drop policy if exists "journal_entries_update_internal" on public.journal_entries;
create policy "journal_entries_update_internal"
on public.journal_entries for update
to authenticated
using (public.is_internal_org_member(organization_id))
with check (public.is_internal_org_member(organization_id));

create table if not exists public.journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.journal_entries(id) on delete cascade,
  account_id uuid not null references public.accounting_accounts(id) on delete restrict,
  side text not null,
  amount numeric not null,
  description text,
  created_at timestamptz default now()
);

alter table public.journal_entry_lines
drop constraint if exists journal_entry_lines_side_check;

alter table public.journal_entry_lines
add constraint journal_entry_lines_side_check
check (side in ('debit', 'credit'));

alter table public.journal_entry_lines
drop constraint if exists journal_entry_lines_amount_check;

alter table public.journal_entry_lines
add constraint journal_entry_lines_amount_check
check (amount >= 0);

create index if not exists journal_entry_lines_entry_idx
on public.journal_entry_lines (journal_entry_id);

alter table public.journal_entry_lines enable row level security;

drop policy if exists "journal_entry_lines_select_internal" on public.journal_entry_lines;
create policy "journal_entry_lines_select_internal"
on public.journal_entry_lines for select
to authenticated
using (
  exists (
    select 1
    from public.journal_entries je
    where je.id = journal_entry_lines.journal_entry_id
      and public.is_internal_org_member(je.organization_id)
  )
);

drop policy if exists "journal_entry_lines_insert_internal" on public.journal_entry_lines;
create policy "journal_entry_lines_insert_internal"
on public.journal_entry_lines for insert
to authenticated
with check (
  exists (
    select 1
    from public.journal_entries je
    where je.id = journal_entry_lines.journal_entry_id
      and public.is_internal_org_member(je.organization_id)
  )
);

drop policy if exists "journal_entry_lines_update_internal" on public.journal_entry_lines;
create policy "journal_entry_lines_update_internal"
on public.journal_entry_lines for update
to authenticated
using (
  exists (
    select 1
    from public.journal_entries je
    where je.id = journal_entry_lines.journal_entry_id
      and public.is_internal_org_member(je.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.journal_entries je
    where je.id = journal_entry_lines.journal_entry_id
      and public.is_internal_org_member(je.organization_id)
  )
);

drop policy if exists "journal_entry_lines_delete_internal" on public.journal_entry_lines;
create policy "journal_entry_lines_delete_internal"
on public.journal_entry_lines for delete
to authenticated
using (
  exists (
    select 1
    from public.journal_entries je
    where je.id = journal_entry_lines.journal_entry_id
      and public.is_internal_org_member(je.organization_id)
  )
);
