# Catalogo contable OM7

Este documento describe la fase 1 del nucleo contable real de OM7 Finance OS.

## Archivos

- `supabase/schema-025-cuentas-contables.sql`: migracion de la tabla oficial `public.cuentas_contables`.
- `supabase/schema-026-cuentas-contables-global.sql`: migracion incremental para soportar catalogo global OM7.
- `scripts/import-catalogo-contable.ts`: importador idempotente desde Excel.
- `src/lib/cuentas-contables.ts`: lectura tipada y armado del arbol.
- `src/components/accounting/cuentas-contables-tree.tsx`: arbol navegable, buscador y filtros.
- `src/app/(platform)/contabilidad/catalogo/page.tsx`: pantalla `/contabilidad/catalogo`.

## Migracion

Ejecutar en Supabase SQL Editor:

```sql
-- supabase/schema-025-cuentas-contables.sql
-- supabase/schema-026-cuentas-contables-global.sql
```

La tabla incluye:

- jerarquia padre-hijo real,
- soporte multinivel,
- catalogo global con `organization_id is null`,
- catalogos por organizacion con `organization_id = organizations.id`,
- unique global por `codigo` cuando `organization_id is null`,
- unique por organizacion para `(organization_id, codigo)` cuando `organization_id is not null`,
- checks de BG/ER, categoria, naturaleza y tipo de cuenta,
- regla para que solo cuentas `detalle` permitan movimientos,
- trigger `updated_at`,
- validacion contra ciclos jerarquicos,
- RLS por membresia interna de organizacion.

## Importacion del Excel

Archivo fuente por defecto:

```text
data/catalogos/Catalogo de cuentas v1 12 mayo 26.xlsx
```

Analisis del archivo actual:

- hojas detectadas: `Hoja1`, `Hoja2`,
- hoja usada para importar: `Hoja1`,
- `Hoja1` contiene Balance General a la izquierda y Estado de Resultados a la derecha,
- `Hoja2` contiene importes de ejemplo y no se usa para crear cuentas,
- dry-run actual: 67 cuentas detectadas, 27 acumulativas y 40 detalle.

Antes de escribir en Supabase se puede validar la lectura:

```bash
npm run import:catalogo -- --dry-run
```

Para importar el catalogo base global OM7 usando el archivo por defecto:

```bash
npm run import:catalogo -- --global
```

Este modo guarda las cuentas con `organization_id = null`. Debe usarse para
crear o actualizar la plantilla oficial compartida de OM7.

Para importar directamente a una organizacion:

```bash
npm run import:catalogo -- --organization="ORG_ID"
```

Ese modo guarda las cuentas con `organization_id = ORG_ID`. Debe usarse cuando
una organizacion ya necesita su propia copia personalizable.

Tambien se puede cambiar el archivo fuente:

```bash
npm run import:catalogo -- --file="data/catalogos/Catalogo de cuentas v1 12 mayo 26.xlsx" --organization="ORG_ID"
```

Variables requeridas:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CATALOGO_ORGANIZATION_ID` si no se pasa `--organization`

`SUPABASE_SERVICE_ROLE_KEY` debe copiarse desde Supabase:

```text
Project Settings -> API -> service_role key
```

No subir `.env.local` a Git. El repo ya ignora `.env*`.

Para obtener el `ORG_ID`, usar Supabase SQL Editor:

```sql
select id, name, created_at
from public.organizations
order by created_at desc;
```

Luego agregar localmente:

```bash
SUPABASE_SERVICE_ROLE_KEY="..."
CATALOGO_ORGANIZATION_ID="..."
```

Tambien se puede usar:

```bash
CATALOGO_ORGANIZATION_ID="ORG_ID" npm run import:catalogo
```

Despues de importar, validar en Supabase:

```sql
select count(*) as total_global
from public.cuentas_contables
where organization_id is null;

select count(*) as total
from public.cuentas_contables
where organization_id = 'ORG_ID';

select tipo_cuenta, permite_movimientos, count(*) as total
from public.cuentas_contables
where organization_id = 'ORG_ID'
group by tipo_cuenta, permite_movimientos
order by tipo_cuenta, permite_movimientos;

select count(*) as cuentas_con_padre
from public.cuentas_contables
where organization_id = 'ORG_ID'
  and cuenta_padre_id is not null;
```

El resultado esperado con el Excel actual es:

- 67 cuentas,
- acumulativas con `permite_movimientos = false`,
- detalle con `permite_movimientos = true`,
- relaciones padre-hijo presentes.

## Copiar plantilla global a una organizacion

El helper queda preparado en:

```ts
copyGlobalAccountingCatalogToOrganization(organizationId)
```

Ubicacion:

```text
src/lib/cuentas-contables.ts
```

Uso esperado futuro:

- se importa una vez el catalogo global con `--global`,
- durante onboarding o configuracion contable se copia a la organizacion,
- la organizacion puede luego personalizar, activar/desactivar o agregar cuentas
  propias sin tocar la plantilla global.

El importador:

- lee `Hoja1` del Excel,
- detecta los bloques de Balance General y Estado de Resultados,
- infiere nivel por codigo,
- normaliza jerarquia de Estado de Resultados bajo sus raices reales,
- corrige duplicados conocidos al siguiente codigo hermano disponible,
- infiere BG/ER, categoria y naturaleza,
- usa la marca explicita `Acumulativa` / `Detalle` cuando existe,
- detecta cuentas acumulativas cuando tienen hijos,
- deja `permite_movimientos = false` en acumulativas,
- deja `permite_movimientos = true` en detalle,
- usa upsert por `(organization_id, codigo)`,
- puede correrse varias veces sin duplicar.

## Validacion esperada

Despues de importar, abrir:

```text
/contabilidad/catalogo
```

Se debe ver el arbol contable con:

- buscador,
- filtros por BG/ER/categoria,
- badges de estado, categoria y tipo,
- indicadores de cuentas acumulativas/detalle,
- resumen del catalogo.
