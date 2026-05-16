do $$
begin
  if to_regclass('public.gmail_xml_imports') is null then
    raise exception 'La tabla public.gmail_xml_imports no existe.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'gmail_xml_imports'
      and column_name in (
        'organization_id',
        'user_id',
        'gmail_message_id',
        'gmail_attachment_id'
      )
    group by table_schema, table_name
    having count(*) = 4
  ) then
    raise exception 'Faltan columnas requeridas en public.gmail_xml_imports.';
  end if;
end;
$$;

alter table public.gmail_xml_imports
drop constraint if exists gmail_xml_imports_unique_attachment;

drop index if exists public.gmail_xml_imports_unique_attachment_idx;
drop index if exists public.gmail_xml_imports_unique_attachment;

create unique index if not exists gmail_xml_imports_unique_attachment
on public.gmail_xml_imports (
  organization_id,
  user_id,
  gmail_message_id,
  gmail_attachment_id
);

notify pgrst, 'reload schema';
