-- OM7 Finance OS - Schema 012
-- Cierre de ciclo documental: conversion a compra/factura.
-- Ejecutar manualmente en Supabase SQL Editor.

alter table public.documents
add column if not exists converted_at timestamptz;

alter table public.documents
add column if not exists converted_type text;

alter table public.documents
add column if not exists converted_record_id uuid;

alter table public.documents
add column if not exists converted_by uuid references auth.users(id) on delete set null;

alter table public.documents
add column if not exists conversion_notes text;

do $$
begin
  alter table public.documents
  drop constraint if exists documents_converted_type_check;

  alter table public.documents
  add constraint documents_converted_type_check
  check (
    converted_type is null
    or converted_type in ('purchase', 'invoice')
  );
end;
$$;

create index if not exists documents_converted_idx
on public.documents (organization_id, company_id, converted_type, converted_at);

create index if not exists documents_converted_record_idx
on public.documents (converted_type, converted_record_id);
