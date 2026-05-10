# Modelo de datos inicial de OM7 Finance OS

Este documento propone tablas, campos principales y relaciones para una futura implementacion en Supabase. No es SQL definitivo y no debe usarse todavia como migracion.

Actualizacion: `supabase/schema-001-organizations.sql` ya fue creado como la primera implementacion manual del modelo organizacional. Incluye `profiles`, `organizations`, `organization_members`, `companies`, `company_users`, triggers de `updated_at` y politicas RLS iniciales para onboarding multiusuario y multiempresa.

## Implementacion 002 — Empresas reales

El modulo `/empresas` ya utiliza datos reales desde Supabase. Las empresas se crean en `companies` asociadas a la organizacion activa del usuario mediante `organization_id`. El acceso queda protegido por RLS: un usuario solo puede listar y crear empresas dentro de organizaciones donde es miembro activo.

La tabla `companies` depende directamente de `organizations`; por eso no puede existir una empresa sin organizacion. Esta implementacion mantiene el modelo SaaS multiempresa y prepara el camino para documentos, facturas, usuarios cliente y reportes por empresa.

## Implementacion 003 — Contexto activo

Se agrego el contexto activo del usuario mediante `profiles.active_organization_id` y `profiles.active_company_id`. La organizacion activa representa el tenant de trabajo y la empresa activa representa el cliente o entidad bajo la cual operaran futuros modulos de facturas, compras, reportes e IA.

El contexto activo se guarda por usuario. `active_company_id` solo debe apuntar a empresas que pertenezcan a organizaciones donde el usuario sea miembro activo. Si no hay empresa activa, la UI puede sugerir la primera empresa disponible, pero no la asigna automaticamente sin accion del usuario.

## Implementacion 004 - Facturas manuales

Se creo `supabase/schema-004-invoices.sql` como primera base real para registrar facturas manuales. La tabla `invoices` depende de `organizations` y `companies`, guarda el usuario que registra el documento en `user_id` y queda preparada para conectarse luego con documentos, OCR e IA.

La UI `/facturas` lista facturas reales de la empresa activa y permite crear registros manuales solo cuando existe `profiles.active_company_id`. La politica RLS de insercion valida que el usuario sea miembro de la organizacion, que la empresa pertenezca a esa organizacion y que coincida con el contexto activo guardado en `profiles`.

## Implementacion 005 - Compras y gastos manuales

Se creo `supabase/schema-005-purchases.sql` para registrar compras y gastos manuales bajo la empresa activa. La tabla `purchases` guarda `organization_id`, `company_id`, `user_id`, proveedor, documento, fecha, categoria, montos, metodo de pago, estado y notas.

La UI `/compras` dejo de depender de datos mock y ahora lista compras reales de `profiles.active_company_id`. La politica RLS sigue el mismo criterio de facturas: lectura por membresia activa en la organizacion e insercion solo cuando la compra coincide con el contexto activo del usuario.

## Implementacion 006 - Almacenamiento documental

Se creo `supabase/schema-006-documents.sql` para preparar el repositorio documental privado de OM7 Finance OS. El bucket `om7-documents` debe existir como privado y usar la ruta logica `organizations/{organization_id}/companies/{company_id}/documents/`.

La tabla `documents` registra la metadata de cada archivo: organizacion, empresa, usuario, entidad relacionada (`invoice`, `purchase` o `general`), ruta de storage, nombre original, tipo MIME, tamano, tipo documental, estado de procesamiento y metadata JSON. Esta tabla es la base para el futuro pipeline OCR e IA, sin procesar todavia el contenido del archivo.

Las politicas RLS aislan documentos por membresia de organizacion y restringen inserciones al contexto activo del usuario (`profiles.active_organization_id` y `profiles.active_company_id`). Supabase Storage queda privado; la UI genera signed URLs temporales para ver documentos sin exponer el bucket publicamente.

## Implementacion 007 - Procesamiento documental

Se creo `supabase/schema-007-document-processing.sql` como base de OCR e IA futura. La tabla `document_extractions` depende de `documents` y guarda el proveedor de extraccion, estado, texto crudo, datos estructurados JSON, confianza, errores y marcas de procesamiento.

La relacion principal es `documents -> document_extractions`. Un documento puede tener una o varias extracciones historicas, empezando por proveedor `manual`. La UI `/documentos` permite simular o ingresar una extraccion manual, cambia `documents.processing_status` a `processed` y muestra un panel tecnico con texto extraido y JSON.

El formato inicial de `extracted_data` queda preparado para IA:

```json
{
  "supplier_name": "",
  "document_number": "",
  "date": "",
  "currency": "",
  "subtotal": 0,
  "tax": 0,
  "total": 0,
  "line_items": []
}
```

El flujo futuro sera: documento privado en Storage, registro en `documents`, extraccion OCR en `document_extractions`, clasificacion IA y posterior creacion o actualizacion de facturas, compras o movimientos.

## Implementacion 008 - XML Costa Rica v1

Se agrego soporte inicial para XML de factura electronica de Costa Rica sin IA ni OCR. El upload documental acepta `.xml`, `application/xml` y `text/xml`, mantiene el archivo en Storage privado y procesa automaticamente los XML mediante `parseCostaRicaInvoiceXml()`.

El parser soporta namespaces de Hacienda y comprobantes `FacturaElectronica`, `TiqueteElectronico`, `NotaCreditoElectronica` y `NotaDebitoElectronica`. Extrae clave, consecutivo, fecha, emisor, receptor, moneda, subtotal, impuesto, total, condicion de venta, medio de pago y lineas de detalle.

El flujo actual es: XML manual -> `documents` -> `document_extractions` con provider `xml-parser-cr` -> vista amigable en `/documentos` -> creacion manual de compra o factura desde los datos extraidos. Antes de crear se muestra advertencia visual ante posibles duplicados por clave o consecutivo, pero no se bloquea la accion todavia.

Canales futuros de recepcion XML:

- Upload manual desde portal cliente.
- Email unico por empresa o cliente.
- Carpeta compartida o integracion.
- API webhook futura.

## Implementacion 009 - Portal cliente v1

Se creo `/cliente` como primera version protegida del portal de recepcion documental. En esta fase el portal usa la sesion autenticada y la empresa activa para asociar documentos de forma segura, manteniendo RLS y Storage privado.

Los archivos subidos desde el portal se registran en `documents` con `related_type = client_upload` y metadata `channel = client_portal`. Los XML de Costa Rica se procesan automaticamente con el parser actual y quedan en `document_extractions`; PDFs e imagenes quedan como recibidos para revision posterior.

Canales futuros de recepcion documental:

- Portal manual para clientes.
- Email unico por cliente o empresa.
- Lectura automatica de adjuntos.
- API/webhook para integraciones externas.

## Implementacion 010 - Bandeja de revision documental

Se creo `supabase/schema-008-document-review.sql` para agregar estado de revision sobre `documents`: `review_status`, `reviewed_at`, `reviewed_by` y `review_notes`. La bandeja `/bandeja` lista documentos recibidos desde el portal cliente (`related_type = client_upload`) bajo la empresa activa.

La bandeja permite filtrar por tipo documental, estado de procesamiento y fecha. Tambien muestra KPIs operativos, acceso al documento con signed URL, enlace a extraccion XML, conversion a compra/factura y acciones de revision: revisado o rechazado.

La seguridad sigue apoyada en las politicas existentes de `documents`: solo miembros de la organizacion activa pueden leer y actualizar documentos de su empresa activa.

## Implementacion 011 - Usuarios cliente v1

Se creo `supabase/schema-009-client-users.sql` para soportar usuarios cliente con permisos limitados mediante `company_users.role = client`. Estos usuarios no necesitan pertenecer a `organization_members`; su alcance queda definido por las empresas asignadas en `company_users`.

Los clientes pueden acceder solo a `/cliente`, subir documentos con `related_type = client_upload` y ver los documentos enviados para sus empresas asignadas. Las rutas internas como dashboard, facturas, compras, documentos, bandeja, reportes, empresas y configuracion redirigen a `/cliente` cuando el usuario no tiene rol interno.

La asignacion inicial se hace desde `/empresas` con el email de un usuario ya registrado. La funcion SQL `assign_client_to_company()` valida que quien asigna sea miembro interno de la organizacion de la empresa y luego crea o actualiza el registro en `company_users`.

## Implementacion 012 - Acceso cliente por empresa

La administracion de clientes queda integrada dentro de `/empresas` mediante el bloque "Acceso Portal Cliente" por cada empresa. El flujo operativo es:

1. Admin entra a Empresas.
2. Revisa o crea la empresa.
3. Asigna usuarios cliente registrados por email.
4. El cliente entra a `/cliente` y sube XML, PDF o imagenes.
5. El equipo interno revisa en `/bandeja`.
6. Un XML procesado puede convertirse en compra o factura.

Se agrego `src/lib/company-clients.ts` para listar clientes asignados, asignar acceso, quitar acceso y obtener empresas disponibles para un usuario cliente. La UI muestra email, rol, estado, fecha de asignacion y acciones de acceso por empresa.

Roles iniciales relevantes:

- `org_owner`, `admin`, `accountant`, `assistant`: usuarios internos con acceso a administracion y bandeja.
- `client`: usuario externo limitado al portal cliente y sus empresas asignadas.

Pendiente futuro: invitacion por correo con token seguro, expiracion, aceptacion guiada y auditoria del ciclo de invitacion.

## Implementacion 013 - Acceso cliente compartible

El bloque "Acceso Portal Cliente" en `/empresas` ahora permite copiar el enlace directo a `/cliente` y un mensaje listo para enviar manualmente por WhatsApp o email. Esto mantiene el flujo simple mientras no exista automatizacion real de invitaciones.

Flujo manual actual:

1. El administrador asigna un usuario cliente registrado a una empresa.
2. Copia el enlace o mensaje desde la empresa.
3. Comparte el acceso por WhatsApp, email u otro canal externo.
4. El cliente ingresa a `/cliente` con su correo registrado y sube XML, PDFs o imagenes.
5. El equipo interno revisa documentos en `/bandeja`.

Pendiente futuro: envio automatico de invitaciones por email, plantillas por organizacion, tokens de acceso, expiracion de invitaciones y seguimiento de entrega/apertura.

## Implementacion 014 - Experiencia cliente cerrada

El flujo de usuario cliente queda preparado para produccion inicial. Los usuarios con `company_users.role = client` y sin membresia interna activa viven dentro de `/cliente`: si intentan entrar a `/dashboard`, `/empresas`, `/facturas`, `/compras`, `/documentos`, `/bandeja`, `/reportes` o `/configuracion`, el proxy los redirige automaticamente al Portal Cliente.

Permisos actuales:

- `owner`, `platform_owner`, `org_owner`, `admin`, `accountant`, `assistant`: usuarios internos con acceso a administracion, empresas, bandeja, documentos y dashboard.
- `client`: usuario externo limitado al Portal Cliente y a empresas asignadas en `company_users`.

Experiencia cliente:

1. El administrador crea o revisa una empresa.
2. Asigna un usuario cliente registrado desde `/empresas`.
3. Comparte el enlace o mensaje del Portal Cliente.
4. El cliente entra a `/cliente`.
5. Si tiene una empresa asignada, se usa automaticamente; si tiene varias, puede elegir.
6. Sube XML, PDFs o imagenes.
7. El equipo interno revisa en `/bandeja` y convierte XML en compras o facturas.

El dashboard interno ahora muestra indicadores del flujo cliente: clientes activos, documentos recibidos hoy, pendientes de revision y accesos al portal.

## Implementacion 015 - OCR IA con OpenAI Vision v1

Se agrego una primera integracion de procesamiento IA para documentos no XML. El XML de Costa Rica mantiene el flujo deterministico con `xml-parser-cr`; PDFs e imagenes pueden procesarse manualmente desde `/documentos` o `/bandeja` mediante el boton "Procesar con IA".

Flujo OpenAI Vision:

1. El documento se sube a Supabase Storage privado.
2. La app genera una signed URL temporal.
3. Si es imagen, se envia la URL firmada a OpenAI Vision.
4. Si es PDF, la app lee temporalmente el archivo firmado y lo envia como `input_file` base64.
5. La respuesta se normaliza a `document_extractions.extracted_data`.
6. La extraccion se guarda con `extraction_provider = openai-vision`.
7. La UI muestra los datos en la misma vista amigable usada para XML.

Diferencia entre XML y OCR IA:

- XML: fuente estructurada y exacta, procesada localmente sin IA.
- PDF/imagen: fuente visual o escaneada, procesada por OpenAI Vision para extraer proveedor, fecha, numero de documento, moneda, subtotal, impuesto, total y lineas.

Variables necesarias:

- `OPENAI_API_KEY`: clave server-side para llamar OpenAI.
- `OPENAI_VISION_MODEL`: opcional. Si no se define, la app usa `gpt-4.1-mini`.

Control inicial de costos:

- La IA se ejecuta solo por accion manual del usuario.
- Si ya existe una extraccion `openai-vision` procesada para el documento, no se reprocesa automaticamente.
- Storage sigue privado y el acceso a documentos mantiene RLS y aislamiento por empresa/organizacion.

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
