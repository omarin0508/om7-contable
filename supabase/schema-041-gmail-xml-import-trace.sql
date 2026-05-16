-- OM7 Finance OS - Schema 041
-- Trazabilidad de adjuntos XML importados desde Gmail.
-- Ejecutar manualmente en Supabase SQL Editor despues de schema-040.

create table if not exists public.gmail_xml_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'gmail',
  gmail_message_id text not null,
  gmail_thread_id text,
  gmail_attachment_id text not null,
  "from" text,
  subject text,
  received_at timestamptz,
  attachment_filename text,
  imported_document_id uuid references public.documents(id) on delete set null,
  import_status text not null default 'pendiente',
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint gmail_xml_imports_source_check check (source = 'gmail'),
  constraint gmail_xml_imports_status_check
    check (import_status in ('pendiente', 'procesado', 'duplicado', 'omitido', 'error')),
  constraint gmail_xml_imports_unique_attachment
    unique (
      organization_id,
      user_id,
      gmail_message_id,
      gmail_attachment_id
    )
);

alter table public.gmail_xml_imports
add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.gmail_xml_imports
add column if not exists source text not null default 'gmail';

alter table public.gmail_xml_imports
add column if not exists gmail_thread_id text;

alter table public.gmail_xml_imports
add column if not exists "from" text;

alter table public.gmail_xml_imports
add column if not exists subject text;

alter table public.gmail_xml_imports
add column if not exists received_at timestamptz;

alter table public.gmail_xml_imports
add column if not exists attachment_filename text;

alter table public.gmail_xml_imports
add column if not exists imported_document_id uuid references public.documents(id) on delete set null;

alter table public.gmail_xml_imports
add column if not exists import_status text not null default 'pendiente';

alter table public.gmail_xml_imports
add column if not exists error_message text;

alter table public.gmail_xml_imports
add column if not exists updated_at timestamptz default now();

alter table public.gmail_xml_imports
drop constraint if exists gmail_xml_imports_status_check;

alter table public.gmail_xml_imports
add constraint gmail_xml_imports_status_check
check (import_status in ('pendiente', 'procesado', 'duplicado', 'omitido', 'error'));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'gmail_xml_imports_unique_attachment'
  ) then
    alter table public.gmail_xml_imports
    add constraint gmail_xml_imports_unique_attachment
      unique (
        organization_id,
        user_id,
        gmail_message_id,
        gmail_attachment_id
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'gmail_xml_imports_source_check'
  ) then
    alter table public.gmail_xml_imports
    add constraint gmail_xml_imports_source_check
      check (source = 'gmail');
  end if;

end;
$$;

drop trigger if exists set_gmail_xml_imports_updated_at on public.gmail_xml_imports;
create trigger set_gmail_xml_imports_updated_at
before update on public.gmail_xml_imports
for each row execute function public.set_updated_at();

alter table public.gmail_xml_imports enable row level security;

drop policy if exists "gmail_xml_imports_select_owner" on public.gmail_xml_imports;
create policy "gmail_xml_imports_select_owner"
on public.gmail_xml_imports for select
to authenticated
using (
  user_id = auth.uid()
  and public.is_org_member(organization_id)
);

drop policy if exists "gmail_xml_imports_insert_owner" on public.gmail_xml_imports;
create policy "gmail_xml_imports_insert_owner"
on public.gmail_xml_imports for insert
to authenticated
with check (
  user_id = auth.uid()
  and source = 'gmail'
  and public.is_org_member(organization_id)
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active_organization_id = gmail_xml_imports.organization_id
  )
);

drop policy if exists "gmail_xml_imports_update_owner" on public.gmail_xml_imports;
create policy "gmail_xml_imports_update_owner"
on public.gmail_xml_imports for update
to authenticated
using (
  user_id = auth.uid()
  and public.is_org_member(organization_id)
)
with check (
  user_id = auth.uid()
  and source = 'gmail'
  and public.is_org_member(organization_id)
);

create index if not exists gmail_xml_imports_context_status_idx
on public.gmail_xml_imports (organization_id, user_id, import_status, created_at desc);

create index if not exists gmail_xml_imports_document_idx
on public.gmail_xml_imports (imported_document_id);
