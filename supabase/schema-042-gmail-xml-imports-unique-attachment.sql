do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'gmail_xml_imports_unique_attachment'
      and conrelid = 'public.gmail_xml_imports'::regclass
  ) then
    create unique index if not exists gmail_xml_imports_unique_attachment_idx
    on public.gmail_xml_imports (
      organization_id,
      user_id,
      gmail_message_id,
      gmail_attachment_id
    );

    alter table public.gmail_xml_imports
    add constraint gmail_xml_imports_unique_attachment
      unique using index gmail_xml_imports_unique_attachment_idx;
  end if;
end;
$$;

notify pgrst, 'reload schema';
