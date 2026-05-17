create table if not exists public.gmail_xml_sync_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  period_key text not null,
  date_from date not null,
  date_to date not null,
  gmail_query text,
  status text not null default 'pendiente',
  found_count integer not null default 0,
  processed_count integer not null default 0,
  imported_count integer not null default 0,
  duplicated_count integer not null default 0,
  omitted_count integer not null default 0,
  error_count integer not null default 0,
  has_more_results boolean not null default false,
  last_synced_at timestamptz,
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint gmail_xml_sync_periods_status_check
    check (status in (
      'pendiente',
      'buscado',
      'importado',
      'pendiente_revision',
      'cerrado',
      'error'
    )),
  constraint gmail_xml_sync_periods_unique_company_period
    unique (organization_id, company_id, period_key)
);

drop trigger if exists set_gmail_xml_sync_periods_updated_at
on public.gmail_xml_sync_periods;
create trigger set_gmail_xml_sync_periods_updated_at
before update on public.gmail_xml_sync_periods
for each row execute function public.set_updated_at();

alter table public.gmail_xml_sync_periods enable row level security;

drop policy if exists "gmail_xml_sync_periods_select_org_member"
on public.gmail_xml_sync_periods;
create policy "gmail_xml_sync_periods_select_org_member"
on public.gmail_xml_sync_periods for select
to authenticated
using (
  public.is_org_member(organization_id)
  and exists (
    select 1
    from public.companies c
    where c.id = gmail_xml_sync_periods.company_id
      and c.organization_id = gmail_xml_sync_periods.organization_id
  )
);

drop policy if exists "gmail_xml_sync_periods_insert_org_member"
on public.gmail_xml_sync_periods;
create policy "gmail_xml_sync_periods_insert_org_member"
on public.gmail_xml_sync_periods for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active_organization_id = gmail_xml_sync_periods.organization_id
      and p.active_company_id = gmail_xml_sync_periods.company_id
  )
);

drop policy if exists "gmail_xml_sync_periods_update_org_member"
on public.gmail_xml_sync_periods;
create policy "gmail_xml_sync_periods_update_org_member"
on public.gmail_xml_sync_periods for update
to authenticated
using (
  public.is_org_member(organization_id)
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active_organization_id = gmail_xml_sync_periods.organization_id
      and p.active_company_id = gmail_xml_sync_periods.company_id
  )
)
with check (
  public.is_org_member(organization_id)
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active_organization_id = gmail_xml_sync_periods.organization_id
      and p.active_company_id = gmail_xml_sync_periods.company_id
  )
);

create index if not exists gmail_xml_sync_periods_context_idx
on public.gmail_xml_sync_periods (
  organization_id,
  company_id,
  status,
  date_from desc
);

notify pgrst, 'reload schema';
