-- OM7 Finance OS - Support 002
-- Normaliza codigos de moneda historicos en Supabase.
-- Ejecutar manualmente en Supabase SQL Editor.

create or replace function pg_temp.om7_normalize_currency_code(value text)
returns text
language plpgsql
as $$
declare
  raw text;
begin
  raw := upper(trim(coalesce(value, '')));

  if raw = '' then
    return 'CRC';
  end if;

  if raw in ('CRC', 'USD', 'EUR') then
    return raw;
  end if;

  if raw like '%CRC%'
    or raw like '%COLON%'
    or raw like '%COLÓN%'
    or raw like '%COLONES%'
    or raw like '%₡%'
    or raw like '%¢%'
  then
    return 'CRC';
  end if;

  if raw like '%USD%'
    or raw like '%DOLAR%'
    or raw like '%DÓLAR%'
    or raw like '%DOLLAR%'
    or raw = '$'
  then
    return 'USD';
  end if;

  if raw like '%EUR%'
    or raw like '%EURO%'
    or raw like '%€%'
  then
    return 'EUR';
  end if;

  return 'CRC';
end;
$$;

do $$
begin
  if to_regclass('public.invoices') is not null then
    update public.invoices
    set moneda = pg_temp.om7_normalize_currency_code(moneda)
    where moneda is distinct from pg_temp.om7_normalize_currency_code(moneda);
  end if;

  if to_regclass('public.purchases') is not null then
    update public.purchases
    set currency = pg_temp.om7_normalize_currency_code(currency)
    where currency is distinct from pg_temp.om7_normalize_currency_code(currency);
  end if;

  if to_regclass('public.companies') is not null then
    update public.companies
    set base_currency = pg_temp.om7_normalize_currency_code(base_currency)
    where base_currency is distinct from pg_temp.om7_normalize_currency_code(base_currency);
  end if;

  if to_regclass('public.organizations') is not null then
    update public.organizations
    set base_currency = pg_temp.om7_normalize_currency_code(base_currency)
    where base_currency is distinct from pg_temp.om7_normalize_currency_code(base_currency);
  end if;

  if to_regclass('public.document_extractions') is not null then
    update public.document_extractions
    set extracted_data = jsonb_set(
      extracted_data,
      '{moneda}',
      to_jsonb(pg_temp.om7_normalize_currency_code(extracted_data->>'moneda')),
      true
    )
    where extracted_data ? 'moneda'
      and (extracted_data->>'moneda') is distinct from pg_temp.om7_normalize_currency_code(extracted_data->>'moneda');

    update public.document_extractions
    set extracted_data = jsonb_set(
      extracted_data,
      '{currency}',
      to_jsonb(pg_temp.om7_normalize_currency_code(extracted_data->>'currency')),
      true
    )
    where extracted_data ? 'currency'
      and (extracted_data->>'currency') is distinct from pg_temp.om7_normalize_currency_code(extracted_data->>'currency');
  end if;
end;
$$;

-- Verificacion opcional despues de correr:
-- select moneda, count(*) from public.invoices group by moneda order by moneda;
-- select currency, count(*) from public.purchases group by currency order by currency;
