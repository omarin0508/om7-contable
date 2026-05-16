do $$
begin
  if to_regclass('public.gmail_xml_imports') is null then
    raise exception 'La tabla public.gmail_xml_imports no existe.';
  end if;
end;
$$;

update public.gmail_xml_imports
set import_status = 'omitido'
where import_status = 'omitted';

alter table public.gmail_xml_imports
drop constraint if exists gmail_xml_imports_status_check;

alter table public.gmail_xml_imports
add constraint gmail_xml_imports_status_check
check (
  import_status in (
    'pendiente',
    'procesado',
    'duplicado',
    'error',
    'omitido'
  )
);

notify pgrst, 'reload schema';
