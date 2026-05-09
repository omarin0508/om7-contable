# Modelo de datos inicial de OM7 Finance OS

Este documento propone tablas, campos principales y relaciones para una futura implementacion en Supabase. No es SQL definitivo y no debe usarse todavia como migracion.

## Principios generales

- Todas las tablas operativas deben tener ownership claro.
- Usar `organization_id` como limite principal de tenant.
- Usar `company_id` cuando la informacion pertenezca a una empresa especifica.
- Usar `created_by` para trazabilidad.
- Incluir `created_at` y `updated_at` en tablas principales.
- Preparar Row Level Security desde el diseno, no como ajuste posterior.

## Tablas propuestas

### profiles

Perfil extendido vinculado al usuario autenticado.

Campos principales:

- `id`: referencia al usuario de Auth.
- `full_name`
- `email`
- `avatar_url`
- `default_organization_id`
- `created_at`
- `updated_at`

Relaciones:

- Un perfil puede pertenecer a varias organizaciones mediante `organization_members`.

### organizations

Tenant principal del sistema. Puede representar una firma contable, una empresa suscrita o una organizacion interna.

Campos principales:

- `id`
- `name`
- `slug`
- `type`: firma contable, empresa, interno.
- `status`: activa, suspendida, pendiente.
- `owner_id`
- `created_at`
- `updated_at`

Relaciones:

- Una organizacion tiene muchos miembros.
- Una organizacion tiene muchas empresas.
- Una organizacion tiene una o varias suscripciones historicas.

### organization_members

Relacion entre usuarios y organizaciones.

Campos principales:

- `id`
- `organization_id`
- `user_id`
- `role`: `org_owner`, `admin`, `accountant`, `assistant`, `client_user`, `viewer`.
- `status`: activo, invitado, suspendido.
- `invited_by`
- `created_at`
- `updated_at`

Relaciones:

- Pertenece a una organizacion.
- Pertenece a un perfil.

### plans

Catalogo de planes comerciales.

Campos principales:

- `id`
- `name`: Basico, Profesional, Empresarial.
- `description`
- `monthly_price`
- `yearly_price`
- `max_companies`
- `max_users`
- `monthly_ai_documents`
- `storage_limit_mb`
- `has_premium_reports`
- `has_automations`
- `has_bank_integrations`
- `created_at`
- `updated_at`

Relaciones:

- Un plan puede tener muchas suscripciones.

### subscriptions

Suscripcion de una organizacion.

Campos principales:

- `id`
- `organization_id`
- `plan_id`
- `status`: activa, trial, vencida, cancelada, suspendida.
- `current_period_start`
- `current_period_end`
- `external_customer_id`
- `external_subscription_id`
- `created_at`
- `updated_at`

Relaciones:

- Pertenece a una organizacion.
- Pertenece a un plan.

### companies

Empresa propia o cliente administrado por una organizacion.

Campos principales:

- `id`
- `organization_id`
- `name`
- `legal_name`
- `tax_id`
- `country`
- `currency`
- `status`: activa, revision, pendiente, archivada.
- `created_by`
- `created_at`
- `updated_at`

Relaciones:

- Pertenece a una organizacion.
- Tiene usuarios mediante `company_users`.
- Tiene documentos, facturas, proveedores, movimientos y reportes.

### company_users

Permisos de usuarios sobre empresas especificas.

Campos principales:

- `id`
- `organization_id`
- `company_id`
- `user_id`
- `role`: `admin`, `accountant`, `assistant`, `client_user`, `viewer`.
- `status`
- `created_by`
- `created_at`
- `updated_at`

Relaciones:

- Pertenece a una organizacion.
- Pertenece a una empresa.
- Pertenece a un perfil.

### suppliers

Proveedores por organizacion y empresa.

Campos principales:

- `id`
- `organization_id`
- `company_id`
- `name`
- `tax_id`
- `email`
- `phone`
- `status`
- `created_by`
- `created_at`
- `updated_at`

Relaciones:

- Pertenece a una empresa.
- Puede tener muchas facturas.
- Puede tener muchas transacciones.

### documents

Archivos cargados al sistema.

Campos principales:

- `id`
- `organization_id`
- `company_id`
- `uploaded_by`
- `file_name`
- `file_type`
- `file_size`
- `storage_path`
- `source`: manual, email, integracion, api.
- `processing_status`: pendiente, procesando, procesado, error, requiere_revision.
- `ai_confidence`
- `created_at`
- `updated_at`

Relaciones:

- Pertenece a una empresa.
- Puede generar una factura.
- Puede dejar eventos en `audit_logs`.

### invoices

Encabezado de facturas extraidas o registradas.

Campos principales:

- `id`
- `organization_id`
- `company_id`
- `document_id`
- `supplier_id`
- `invoice_number`
- `issue_date`
- `due_date`
- `currency`
- `subtotal`
- `tax_total`
- `total`
- `status`: borrador, validar, aprobada, rechazada, contabilizada.
- `ai_confidence`
- `created_by`
- `created_at`
- `updated_at`

Relaciones:

- Pertenece a una empresa.
- Puede pertenecer a un documento.
- Pertenece a un proveedor.
- Tiene muchas lineas en `invoice_lines`.

### invoice_lines

Detalle de productos, servicios o conceptos dentro de una factura.

Campos principales:

- `id`
- `organization_id`
- `company_id`
- `invoice_id`
- `description`
- `quantity`
- `unit_price`
- `tax_rate`
- `line_total`
- `accounting_category_id`
- `created_at`
- `updated_at`

Relaciones:

- Pertenece a una factura.
- Puede vincularse a una categoria contable.

### accounting_categories

Categorias contables configurables.

Campos principales:

- `id`
- `organization_id`
- `company_id`
- `name`
- `code`
- `type`: ingreso, gasto, activo, pasivo, patrimonio.
- `parent_id`
- `status`
- `created_by`
- `created_at`
- `updated_at`

Relaciones:

- Puede pertenecer a una organizacion o empresa.
- Puede tener categoria padre.
- Puede usarse en facturas, lineas y transacciones.

### transactions

Movimientos financieros.

Campos principales:

- `id`
- `organization_id`
- `company_id`
- `supplier_id`
- `invoice_id`
- `accounting_category_id`
- `type`: ingreso, gasto, transferencia, ajuste.
- `description`
- `transaction_date`
- `amount`
- `currency`
- `status`: pendiente, conciliado, revision, anulado.
- `created_by`
- `created_at`
- `updated_at`

Relaciones:

- Pertenece a una empresa.
- Puede vincularse a proveedor, factura y categoria contable.

### reports

Reportes generados o guardados.

Campos principales:

- `id`
- `organization_id`
- `company_id`
- `created_by`
- `name`
- `type`: flujo_caja, compras_proveedor, impuestos, balance, cuentas_pagar, centros_costo.
- `format`: dashboard, pdf, excel.
- `status`: disponible, generando, error, archivado.
- `storage_path`
- `period_start`
- `period_end`
- `created_at`
- `updated_at`

Relaciones:

- Pertenece a una organizacion.
- Puede pertenecer a una empresa.

### audit_logs

Bitacora de acciones relevantes.

Campos principales:

- `id`
- `organization_id`
- `company_id`
- `actor_id`
- `action`
- `entity_type`
- `entity_id`
- `metadata`
- `ip_address`
- `user_agent`
- `created_at`

Relaciones:

- Pertenece a una organizacion.
- Puede pertenecer a una empresa.
- Registra acciones de usuarios sobre entidades clave.

## Relaciones clave

```text
profiles
  -> organization_members
  -> organizations
  -> companies
  -> documents
  -> invoices
  -> invoice_lines

organizations
  -> subscriptions
  -> plans

companies
  -> company_users
  -> suppliers
  -> accounting_categories
  -> transactions
  -> reports
  -> audit_logs
```

## Notas para RLS futura

- `platform_owner` debe tener politicas separadas y auditadas.
- Usuarios de organizacion solo ven registros donde exista membresia activa.
- Usuarios cliente solo ven empresas asignadas en `company_users`.
- `viewer` no debe poder insertar, actualizar ni borrar registros.
- Las operaciones sensibles deben registrar eventos en `audit_logs`.

## Pendiente antes de SQL definitivo

- Definir nombres exactos de enums.
- Definir estrategia de soft delete o archivado.
- Definir indices por `organization_id`, `company_id` y fechas.
- Definir limites por plan y mecanismos de enforcement.
- Definir convenciones de storage para documentos y reportes.
