do $$
begin
  if to_regclass('public.gmail_xml_imports') is null then
    raise exception 'La tabla public.gmail_xml_imports no existe.';
  end if;
end;
$$;

alter table public.gmail_xml_imports
add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'gmail_xml_imports'
      and column_name = 'company_id'
  ) then
    update public.gmail_xml_imports imports
    set organization_id = companies.organization_id
    from public.companies companies
    where imports.organization_id is null
      and imports.company_id = companies.id;

    alter table public.gmail_xml_imports
    alter column company_id drop not null;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from public.gmail_xml_imports
    where organization_id is null
  ) then
    raise exception 'No se puede dejar organization_id como obligatorio: hay filas sin organizacion.';
  end if;
end;
$$;

alter table public.gmail_xml_imports
alter column organization_id set not null;

alter table public.gmail_xml_imports
drop constraint if exists gmail_xml_imports_unique_attachment;

drop index if exists public.gmail_xml_imports_unique_attachment_idx;
drop index if exists public.gmail_xml_imports_unique_attachment;

delete from public.gmail_xml_imports current_row
using (
  select id
  from (
    select
      id,
      row_number() over (
        partition by organization_id, user_id, gmail_message_id, gmail_attachment_id
        order by created_at desc nulls last, id desc
      ) as row_number
    from public.gmail_xml_imports
  ) duplicates
  where duplicates.row_number > 1
) duplicate_rows
where current_row.id = duplicate_rows.id;

create unique index gmail_xml_imports_unique_attachment
on public.gmail_xml_imports (
  organization_id,
  user_id,
  gmail_message_id,
  gmail_attachment_id
);

notify pgrst, 'reload schema';
