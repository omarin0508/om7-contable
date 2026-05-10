-- OM7 Finance OS - Support 001
-- Hacer visible para omarinzamroa el ultimo PDF subido por Sergio.
-- Uso exclusivo de pruebas. Ejecutar manualmente en Supabase SQL Editor.
--
-- Que hace:
-- 1. Busca el usuario Sergio por email.
-- 2. Busca el usuario omarinzamroa por email.
-- 3. Toma el ultimo PDF subido por Sergio.
-- 4. Asegura que omarinzamroa sea miembro interno de la organizacion del PDF.
-- 5. Deja como contexto activo la organizacion/empresa donde esta ese PDF.
--
-- No borra documentos.
-- No mueve archivos de Storage.
-- No expone el bucket.

do $$
declare
  sergio_user auth.users;
  omar_user auth.users;
  target_document public.documents;
begin
  select *
  into sergio_user
  from auth.users
  where lower(email) like '%sergio%'
  order by created_at desc
  limit 1;

  if sergio_user.id is null then
    raise exception 'No encontre usuario Sergio. Ajusta el filtro de email en este script.';
  end if;

  select *
  into omar_user
  from auth.users
  where lower(email) like '%omarinzamroa%'
     or lower(email) like '%omarinzamora%'
     or lower(email) like '%omarin%'
  order by created_at desc
  limit 1;

  if omar_user.id is null then
    raise exception 'No encontre usuario Omar. Ajusta el filtro de email en este script.';
  end if;

  select *
  into target_document
  from public.documents
  where user_id = sergio_user.id
    and (
      mime_type = 'application/pdf'
      or lower(coalesce(original_filename, '')) like '%.pdf'
    )
  order by created_at desc
  limit 1;

  if target_document.id is null then
    raise exception 'No encontre PDF subido por Sergio.';
  end if;

  insert into public.profiles (
    id,
    email,
    active_organization_id,
    active_company_id
  )
  values (
    omar_user.id,
    lower(omar_user.email),
    target_document.organization_id,
    target_document.company_id
  )
  on conflict (id) do update set
    email = coalesce(public.profiles.email, excluded.email),
    active_organization_id = excluded.active_organization_id,
    active_company_id = excluded.active_company_id;

  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    status
  )
  values (
    target_document.organization_id,
    omar_user.id,
    'admin',
    'active'
  )
  on conflict (organization_id, user_id) do update set
    role = 'admin',
    status = 'active';

  insert into public.company_users (
    company_id,
    user_id,
    role,
    status,
    invited_at,
    accepted_at
  )
  values (
    target_document.company_id,
    omar_user.id,
    'admin',
    'active',
    now(),
    now()
  )
  on conflict (company_id, user_id) do update set
    role = 'admin',
    status = 'active',
    accepted_at = now();

  raise notice 'Listo. Omar ahora tiene contexto activo sobre company_id %, document_id %.',
    target_document.company_id,
    target_document.id;
end;
$$;

select
  d.id as document_id,
  d.original_filename,
  d.mime_type,
  d.related_type,
  d.processing_status,
  d.created_at,
  c.name as company_name,
  o.name as organization_name,
  uploader.email as uploaded_by
from public.documents d
join public.companies c on c.id = d.company_id
join public.organizations o on o.id = d.organization_id
join auth.users uploader on uploader.id = d.user_id
where lower(uploader.email) like '%sergio%'
  and (
    d.mime_type = 'application/pdf'
    or lower(coalesce(d.original_filename, '')) like '%.pdf'
  )
order by d.created_at desc
limit 1;
