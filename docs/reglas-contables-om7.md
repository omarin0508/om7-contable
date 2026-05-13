# Reglas contables OM7

Las reglas contables conectan cada modulo operativo con cuentas reales del
catalogo contable. La interfaz `/contabilidad/reglas` administra la
configuracion, pero no genera asientos ni recalcula saldos: la contabilizacion
sigue ocurriendo en SQL/RPC/backend.

## Alcance

- Una regla global (`organization_id is null`) funciona como base OM7.
- Una regla por organizacion tiene prioridad sobre la global cuando coincide el
  tipo o categoria.
- Las reglas activas son las unicas que usa el motor contable.
- Para retirar una regla se prefiere desactivarla, no borrarla.

## Compras

Las compras usan `reglas_contables_compras`.

- `categoria_compra`: categoria operativa de la compra.
- `cuenta_debito_id`: gasto/costo o activo debitado.
- `cuenta_credito_id`: proveedor o contrapartida por pagar.
- `cuenta_iva_id`: IVA acreditable cuando aplica.
- `requiere_centro_costo`: exige centro de costo en el asiento si aplica.

## Facturas

Las facturas usan `reglas_contables_facturas`.

- `categoria_factura`: categoria o tipo de venta.
- `cuenta_clientes_id`: cuenta por cobrar.
- `cuenta_ingreso_id`: ingreso.
- `cuenta_iva_debito_id`: IVA debito cuando aplica.

## Caja/Bancos

Caja y bancos usan `reglas_contables_caja`.

- `tipo_movimiento`: pago de compra, cobro de factura o transferencia.
- `categoria_movimiento`: clasificacion opcional.
- `cuenta_caja_banco_id`: cuenta de efectivo.
- `cuenta_contrapartida_id`: cuenta operativa de contrapartida.
- `cuenta_iva_id`: IVA cuando aplica.

## Planillas

Planillas usan `reglas_contables_planillas`.

- `tipo_planilla`: semanal, quincenal, mensual u otro tipo permitido.
- `clasificacion_laboral`: clasificacion opcional.
- `cuenta_gasto_salarios_id`: gasto de salarios.
- `cuenta_cargas_sociales_id`: cargas patronales.
- `cuenta_banco_id`: banco/caja para el pago neto.
- `cuenta_obligaciones_id`: retenciones y obligaciones laborales.

## Subcontratos

Subcontratos usan `reglas_contables_subcontratos`.

- `tipo_subcontrato`: obra, servicio u otro tipo.
- `categoria_subcontrato`: clasificacion opcional.
- `cuenta_costo_subcontrato_id`: costo/gasto de obra.
- `cuenta_proveedor_id`: proveedor/subcontratista.
- `cuenta_banco_id`: banco/caja si el pago esta marcado como pagado.
- `cuenta_retenciones_id`: retenciones por pagar.

## Validacion

Antes de guardar, OM7 valida con `validar_regla_contable` que:

- Las cuentas existan.
- Sean cuentas detalle.
- Esten activas.
- Permitan movimientos.
- Pertenezcan a la organizacion o al catalogo global.
- No exista otra regla activa con la misma categoria/tipo y prioridad.

## Uso operativo

Cuando un modulo genera asiento, llama su RPC de contabilizacion. Esa RPC busca
la regla activa mas especifica y registra el asiento oficial. La UI de reglas
solo administra configuracion; no construye lineas contables.
