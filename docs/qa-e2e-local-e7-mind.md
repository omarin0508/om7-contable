# QA local E7 Mind

Modo demo para probar OM7 sin depender de una sesion personal del navegador.

## Importante

Este flujo es solo para Supabase local o una base demo controlada. No ejecutes el seed en produccion.

## Usuario demo

- Email: `qa.e7@om7.local`
- Password: `OM7Demo2026!`

Crear este usuario desde Supabase Dashboard:

1. Authentication
2. Users
3. Add user / Create user
4. Email: `qa.e7@om7.local`
5. Password: `OM7Demo2026!`
6. Marcar email como confirmado o confirmar el usuario desde el dashboard.
7. Confirmar que el `User UID` sea:

```sql
00000000-0000-4000-8000-000000000700
```

El seed ya viene configurado con ese UID y repara el acceso Auth demo: confirma el email, reinicia la contrasena a `OM7Demo2026!` y reconstruye la identidad `email`. Si Supabase genera otro UID porque recreaste el usuario, cambia `qa_user_id` en `supabase/seed-003-qa-e7-local.sql` por el UID real.

El seed no crea ni consulta filas en `auth.users` ni `auth.identities`. Usa el UID real creado por Supabase Auth y solo monta datos operativos.

## Preparacion

1. Ejecutar las migraciones hasta:
   - `supabase/schema-023-record-update-policies.sql`
   - `supabase/schema-024-e7-mind-distributions.sql`
2. Crear el usuario demo desde Supabase Auth si no existe.
3. Ejecutar en Supabase SQL Editor local:
   - `supabase/seed-003-qa-e7-local.sql`
4. Levantar la app:

```powershell
npm.cmd run dev
```

5. Entrar a:

```text
http://localhost:3000/login
```

6. Iniciar sesion con el usuario demo.

## Documento demo

- Documento: `QA E7 - Factura demo`
- ID: `00000000-0000-4000-8000-000000000703`
- Ruta directa:

```text
http://localhost:3000/documentos/00000000-0000-4000-8000-000000000703
```

Nota: el seed crea el registro documental y la extraccion. No sube un binario real a Storage, por lo que el preview del archivo puede no mostrarse. El flujo E7, datos extraidos y sincronizacion funcionan con datos reales de tablas.

## Flujo a probar

1. Abrir `/documentos`.
2. Entrar a `QA E7 - Factura demo`.
3. Confirmar que se ve extraccion, contraparte y boton `Abrir E7 Mind`.
4. Abrir `/documentos/00000000-0000-4000-8000-000000000703/distribucion`.
5. Confirmar:
   - lineas visibles,
   - cuenta sugerida,
   - centro de costo,
   - IVA debito fiscal,
   - asiento sugerido balanceado.
6. Editar una linea demo.
7. Guardar ajustes.
8. Confirmar notice visible.
9. Presionar `Aprobar y sincronizar registro`.
10. Confirmar redireccion a `/facturas`.
11. Confirmar que aparece la factura creada desde documento.
12. Volver al documento demo y abrir E7 Mind de nuevo.
13. Presionar otra vez `Aprobar y sincronizar registro`.
14. Confirmar que no se duplica la factura, sino que se actualiza la existente.
15. En `/facturas`, marcar revisada y aprobar.
16. Registrar cobro si aplica.
17. Generar asiento desde el flujo contable.

## Resultado esperado

- No hay crash.
- Los errores se muestran como notice/error controlado.
- La factura queda con:
  - `source_document_id`,
  - `source_extraction_id`,
  - `conversion_metadata.e7_mind`,
  - `distribution_line_ids`,
  - `rule_applied`,
  - `confidence`.
- Reaprobar E7 no crea duplicados.

## Reset de la prueba

Vuelve a ejecutar:

```text
supabase/seed-003-qa-e7-local.sql
```

El seed limpia compras/facturas/asientos/cobros generados desde el documento demo y vuelve a dejarlo sin convertir.
