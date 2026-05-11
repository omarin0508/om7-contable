# Checklist prueba flujo documental OM7

## Preparacion

- [ ] Aplicar en Supabase los schemas pendientes hasta `schema-019-accounting-review-status.sql`.
- [ ] Confirmar que existe un usuario admin/contador con acceso al despacho.
- [ ] Confirmar que existe una empresa/cliente demo activa.
- [ ] Si no hay empresa demo, ejecutar `supabase/seed-001-demo-company.sql` o `supabase/seed-002-demo-data-all-organizations.sql`.
- [ ] Crear o confirmar un usuario cliente real en Supabase Auth.
- [ ] Asignar el usuario cliente a la empresa demo desde `/empresas`.
- [ ] Tener a mano 2 archivos:
  - [ ] XML de factura electronica Costa Rica.
  - [ ] PDF o imagen de factura/recibo.

Nota: los seeds actuales crean empresa y registros demo, pero los usuarios Auth y los archivos Storage se prueban manualmente.

## Cliente

- [ ] Iniciar sesion con el usuario cliente.
- [ ] Entrar a `/cliente`.
- [ ] Confirmar que solo ve empresas asignadas.
- [ ] Confirmar que entiende el bloque: subir documento, OM7 procesa, contador revisa.
- [ ] Subir XML.
- [ ] Subir PDF o imagen.
- [ ] Confirmar mensaje de exito o advertencia clara.
- [ ] Confirmar que el historial muestra nombre, fecha, tipo y estado entendible.
- [ ] Confirmar que no ve datos internos, JSON, compras, facturas ni acciones contables.
- [ ] Probar desde ancho movil.

## Admin / contador

- [ ] Iniciar sesion con usuario admin/contador.
- [ ] Entrar a `/dashboard`.
- [ ] Confirmar empresa activa correcta.
- [ ] Entrar a `/bandeja`.
- [ ] Confirmar que aparecen los documentos recibidos del cliente.
- [ ] Abrir el workspace del XML.
- [ ] Confirmar vista humana del documento, no XML crudo como vista principal.
- [ ] Confirmar datos detectados.
- [ ] Confirmar Sugerencia OM7.
- [ ] Confirmar proveedor/cliente detectado.
- [ ] Revisar y aprobar datos detectados.
- [ ] Convertir a compra o factura segun corresponda.

## Trazabilidad

- [ ] Confirmar que el documento queda marcado como convertido.
- [ ] Abrir `/compras` o `/facturas`.
- [ ] Confirmar badge `Desde documento`.
- [ ] Confirmar que aparece contraparte si fue detectada/asociada.
- [ ] Usar `Ver documento` desde compra/factura.
- [ ] Usar `Ver contraparte` desde compra/factura si aplica.
- [ ] Volver al documento y confirmar boton `Ver compra` o `Ver factura`.

## Revision del registro

- [ ] En `/compras` o `/facturas`, marcar el registro como `Marcar revisada`.
- [ ] Confirmar que cambia el badge.
- [ ] Marcar como `Aprobar`.
- [ ] Confirmar que queda aprobado.
- [ ] Marcar otro registro como `Observar con nota`.
- [ ] Entrar a `/observados`.
- [ ] Confirmar que aparece la nota de observacion.
- [ ] Desde `/observados`, abrir documento y contraparte si existen.
- [ ] Desde `/observados`, marcar como revisado.
- [ ] Confirmar que sale de `/observados`.
- [ ] Repetir observacion y luego aprobar.
- [ ] Confirmar que sale de `/observados`.

## Dashboard

- [ ] Confirmar KPIs de documentos, compras, facturas y registros observados.
- [ ] Confirmar que `Registros observados` lleva a `/observados`.
- [ ] Confirmar que `Compras por revisar` lleva a `/compras?filter=accounting_pending`.
- [ ] Confirmar que `Facturas por revisar` lleva a `/facturas?filter=accounting_pending`.
- [ ] Confirmar que actividad reciente muestra badges humanos.
- [ ] Confirmar que no aparecen textos tecnicos como `review_status`, `conversion_metadata` o JSON.

## Responsive

- [ ] Probar `/cliente` en movil.
- [ ] Probar `/dashboard` en movil.
- [ ] Probar `/bandeja` en movil.
- [ ] Probar `/documentos/[documentId]` en movil.
- [ ] Probar `/observados` en movil.
- [ ] Probar `/compras` en movil.
- [ ] Probar `/facturas` en movil.
- [ ] Confirmar que no hay scroll horizontal incomodo.
- [ ] Confirmar que botones principales son visibles.
- [ ] Confirmar que chips/filtros no tapan acciones.

## Criterios de aprobacion

- [ ] Cliente puede subir documentos sin ayuda.
- [ ] Contador sabe que documento revisar primero.
- [ ] Documento convertido queda trazado.
- [ ] Compra/factura puede revisarse, aprobarse u observarse.
- [ ] Observados funciona como cola de correccion.
- [ ] Dashboard permite entender en 10 segundos que entro, que falta y donde actuar.
