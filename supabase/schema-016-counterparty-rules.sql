create table if not exists public.counterparty_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  counterparty_id uuid not null references public.counterparties(id) on delete cascade,
  rule_name text not null,
  flow_type text not null,
  suggested_category text,
  suggested_account text,
  suggested_cost_center_id uuid,
  priority integer not null default 100,
  is_active boolean not null default true,
  created_from_document_id uuid references public.documents(id) on delete set null,
  created_from_classification_id uuid references public.document_classifications(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.counterparty_rules
drop constraint if exists counterparty_rules_flow_type_check;

alter table public.counterparty_rules
add constraint counterparty_rules_flow_type_check
check (flow_type in ('purchase', 'sale', 'expense', 'income'));

create index if not exists counterparty_rules_counterparty_idx
on public.counterparty_rules (counterparty_id, is_active, priority);

create index if not exists counterparty_rules_organization_idx
on public.counterparty_rules (organization_id, is_active);

create unique index if not exists counterparty_rules_unique_active_suggestion_idx
on public.counterparty_rules (
  counterparty_id,
  flow_type,
  coalesce(suggested_category, ''),
  coalesce(suggested_account, ''),
  coalesce(suggested_cost_center_id, '00000000-0000-0000-0000-000000000000'::uuid)
)
where is_active = true;

drop trigger if exists set_counterparty_rules_updated_at on public.counterparty_rules;
create trigger set_counterparty_rules_updated_at
before update on public.counterparty_rules
for each row execute function public.set_updated_at();

alter table public.counterparty_rules enable row level security;

drop policy if exists "counterparty_rules_select_internal" on public.counterparty_rules;
create policy "counterparty_rules_select_internal"
on public.counterparty_rules for select
to authenticated
using (public.is_internal_org_member(organization_id));

drop policy if exists "counterparty_rules_insert_internal" on public.counterparty_rules;
create policy "counterparty_rules_insert_internal"
on public.counterparty_rules for insert
to authenticated
with check (public.is_internal_org_member(organization_id));

drop policy if exists "counterparty_rules_update_internal" on public.counterparty_rules;
create policy "counterparty_rules_update_internal"
on public.counterparty_rules for update
to authenticated
using (public.is_internal_org_member(organization_id))
with check (public.is_internal_org_member(organization_id));
