# OM7 Contable V1 - Checklist de release

Fecha de preparacion: 2026-05-13

## Alcance

OM7 Contable V1 queda preparado como version operativa de contabilidad backend-first. La generacion contable, reportes, alertas, cierres, presupuesto vs real y reglas contables se apoyan en SQL/RPC/backend. El frontend muestra resultados, dispara acciones autorizadas y administra configuracion; no calcula reportes oficiales ni construye asientos contables.

## Modulos conectados

- Catalogo contable global y organizacional.
- Motor de asientos contables.
- Compras contabilizadas.
- Facturas contabilizadas.
- Caja/Bancos: pagos, cobros y transferencias.
- Planillas.
- Subcontratos.
- Mayor general.
- Balance de comprobacion.
- Balance general.
- Estado de resultados.
- Flujo de efectivo.
- Dashboard ejecutivo contable.
- Checklist y cierre mensual contable.
- Presupuesto vs contabilidad real por centro de costo.
- Administracion UI de reglas contables.
- Exportaciones Excel financieras.

## Schemas aplicados

- `schema-025-cuentas-contables.sql`
- `schema-026-cuentas-contables-global.sql`
- `schema-027-asientos-contables.sql`
- `schema-028-saldos-contables.sql`
- `schema-029-estados-financieros.sql`
- `schema-030-contabilizacion-compras.sql`
- `schema-031-contabilizacion-facturas.sql`
- `schema-032-contabilizacion-caja.sql`
- `schema-033-contabilizacion-planillas.sql`
- `schema-034-contabilizacion-subcontratos.sql`
- `schema-035-flujo-efectivo.sql`
- `schema-036-dashboard-contable.sql`
- `schema-037-cierres-contables.sql`
- `schema-038-presupuesto-vs-contabilidad.sql`
- `schema-039-reglas-contables-admin.sql`
- `schema-039b-fix-validar-regla-contable.sql`

## Rutas principales

- `/dashboard`
- `/contabilidad`
- `/contabilidad/catalogo`
- `/contabilidad/asientos`
- `/contabilidad/mayor`
- `/contabilidad/balance-comprobacion`
- `/contabilidad/balance-general`
- `/contabilidad/estado-resultados`
- `/contabilidad/flujo-efectivo`
- `/contabilidad/reportes`
- `/contabilidad/reportes/exportar/excel`
- `/contabilidad/cierres`
- `/contabilidad/cierres/[cierreId]`
- `/contabilidad/presupuesto-vs-real`
- `/contabilidad/reglas`
- `/compras`
- `/facturas`
- `/planillas`
- `/subcontratos`

## Validacion ejecutada

### Local

- `npm.cmd run lint`: OK
- `npm.cmd run build`: OK
- `npm run dev`: detectado dev server activo en `localhost:3000`.
- Smoke anonimo de rutas protegidas: OK, responden `307` a `/login?next=...`.

Durante el smoke se corrigio `src/proxy.ts` para incluir rutas protegidas de contabilidad, planillas, movimientos, periodos, subcontratos, contrapartes, observados y visor de documento. Antes de esa correccion, algunas rutas contables podian responder `500` sin sesion.

### Supabase/API QA

Organizacion QA usada:

- `001f7098-28b3-4eef-8b4a-e86f516fc644`

Objetos validados por API:

- Tablas base de catalogo, asientos, reglas, subcontratos, cierres, centros de costo y presupuestos.
- RPCs financieras: balance comprobacion, balance general, estado resultados, resumen financiero, flujo efectivo, dashboard contable, alertas, presupuesto vs contabilidad y reglas contables.

Smoke funcional QA:

- Compra QA genero asiento backend/RPC: `48a86e82-74bf-4c2d-856f-1b84b85bb9cf`, Debe/Haber `25/25`.
- Factura QA genero asiento backend/RPC: `6d106bcf-6dba-4afc-8909-21e710171e31`, Debe/Haber `30/30`.
- Transferencia caja/banco QA genero asiento backend/RPC: `ddfa46eb-3bc0-4474-8724-7d77bbfeda8e`, Debe/Haber `10/10`.
- Planilla QA genero asiento backend/RPC: `84318d58-230d-44a9-9d94-a6c4806bb4f3`, Debe/Haber `55/55`.
- `get_resumen_financiero`: OK.
- `get_resumen_flujo_efectivo`: OK.

## Seguridad revisada

- `.env.local` esta ignorado por Git.
- `SUPABASE_SERVICE_ROLE_KEY` no se usa en `src/` para cliente/frontend.
- Rutas protegidas pasan por `src/proxy.ts`.
- Helpers server-side usan sesion Supabase y validan usuario/organizacion.
- RPCs sensibles usan membresia interna o `service_role` server-side.
- Exportacion Excel queda detras de ruta protegida y helper server-side.

## Variables requeridas

Local y Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Server-side si se usa vision/documentos:

- `OPENAI_API_KEY`
- `OPENAI_VISION_MODEL`

Solo servidor/operacion, nunca frontend:

- `SUPABASE_SERVICE_ROLE_KEY`

Checklist Vercel pendiente desde consola:

- Confirmar que `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` existen en Production.
- Confirmar que `SUPABASE_SERVICE_ROLE_KEY` no aparece en variables expuestas al cliente ni en codigo bundleado.
- Confirmar logs de build sin errores.
- Confirmar rutas protegidas redirigen a login sin sesion en produccion.

## Checklist QA final

- Login usuario QA.
- Entrar a `/dashboard`.
- Entrar a `/contabilidad`.
- Abrir catalogo, asientos, mayor, balance comprobacion, balance general, estado resultados y flujo efectivo.
- Exportar Excel desde `/contabilidad/reportes`.
- Crear compra aprobada y generar asiento.
- Crear factura aprobada y generar asiento.
- Crear transferencia caja/banco y generar asiento.
- Crear planilla aprobada y generar asiento.
- Validar subcontrato si aplica en datos QA.
- Generar cierre contable mensual.
- Abrir presupuesto vs real.
- Administrar reglas contables: crear, editar, desactivar, reactivar y duplicar global a organizacion.
- Verificar que usuarios no miembros no ven datos de otra organizacion.

## Pendientes conocidos

- Verificacion de variables y logs en Vercel debe hacerse desde la consola de Vercel o con Vercel CLI autenticado. La CLI no esta instalada en este entorno local.
- El bloqueo definitivo de contabilizaciones en periodos cerrados queda preparado como fase futura.
- PDF, consolidacion multiempresa y cierre fiscal avanzado no forman parte de V1.

## Comandos de validacion

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd run dev
```

Smoke anonimo esperado:

- Rutas protegidas devuelven `307` hacia `/login?next=...`.
- `/contabilidad/reportes/exportar/excel` tambien queda protegida por proxy.
