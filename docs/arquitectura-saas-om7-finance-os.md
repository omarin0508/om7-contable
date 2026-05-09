# Arquitectura SaaS de OM7 Finance OS

## 1. Vision SaaS del sistema

OM7 Finance OS sera una plataforma financiera y contable inteligente, disenada para operar como SaaS multiusuario, multiempresa y multicliente. El sistema debe servir como base para que el dueno de la plataforma comercialice membresias, active planes y controle el crecimiento del producto.

La plataforma debe permitir que firmas contables administren varios clientes desde una misma organizacion, que empresas suscritas tengan usuarios internos propios, y que clientes externos consulten movimientos, documentos y reportes con permisos controlados.

La IA sera una capa de asistencia para procesar documentos, leer facturas, extraer datos, clasificar informacion, sugerir categorias contables y apoyar la validacion financiera. La IA no reemplaza el control humano: acelera el trabajo y deja trazabilidad.

## 2. Jerarquia principal

La estructura conceptual inicial del producto sera:

```text
OM7 Platform Owner
-> Organizacion / Firma contable / Empresa suscrita
-> Empresas o clientes administrados
-> Usuarios internos
-> Usuarios cliente / consulta
-> Documentos, facturas, movimientos, reportes
```

Cada nivel debe tener ownership claro. La plataforma administra organizaciones; las organizaciones administran empresas o clientes; las empresas agrupan documentos, facturas, movimientos y reportes.

## 3. Roles iniciales

- `platform_owner`: controla la plataforma completa, planes, organizaciones, configuracion global, auditoria y operaciones internas de OM7.
- `org_owner`: dueno de una organizacion suscrita. Administra miembros, empresas, clientes, permisos y configuracion de su organizacion.
- `admin`: usuario administrativo dentro de una organizacion. Gestiona empresas, usuarios, documentos y configuraciones operativas segun permisos.
- `accountant`: usuario contable. Revisa facturas, clasifica movimientos, valida informacion financiera y prepara reportes.
- `assistant`: apoyo operativo. Puede cargar documentos, revisar pendientes y completar tareas limitadas.
- `client_user`: usuario cliente con acceso a una o varias empresas asignadas. Puede consultar documentos, movimientos y reportes autorizados.
- `viewer`: usuario de solo lectura. Consulta informacion permitida sin crear, editar ni aprobar registros.

## 4. Entidades principales futuras

- `profiles`: perfil extendido del usuario autenticado.
- `organizations`: organizaciones suscritas, firmas contables o empresas principales.
- `organization_members`: relacion entre usuarios y organizaciones, con rol y estado.
- `subscriptions`: suscripcion activa, historial y estado de pago de una organizacion.
- `plans`: planes comerciales disponibles y limites asociados.
- `companies`: empresas propias o clientes administrados dentro de una organizacion.
- `company_users`: relacion entre usuarios y empresas especificas.
- `documents`: archivos cargados, metadata, estado de procesamiento y origen.
- `invoices`: encabezado de factura extraido o registrado.
- `invoice_lines`: lineas de detalle de cada factura.
- `suppliers`: proveedores detectados o registrados.
- `accounting_categories`: categorias contables configurables por organizacion o empresa.
- `transactions`: movimientos financieros, compras, gastos, ingresos o ajustes.
- `reports`: reportes generados, guardados o programados.
- `audit_logs`: bitacora de acciones relevantes para seguridad, trazabilidad y cumplimiento.

## 5. Principio de seguridad

Regla central:

> Nada debe existir suelto. Todo debe pertenecer a una organizacion, empresa o usuario.

Este principio evita datos huerfanos, reduce riesgos de filtracion entre clientes y facilita auditoria, permisos, facturacion y soporte.

## 6. Principio RLS futuro

Cuando se conecte Supabase, todas las tablas deben disenarse pensando desde el inicio en Row Level Security. Las entidades deben incluir:

- `organization_id`
- `company_id` cuando aplique
- `created_by`
- `created_at`
- `updated_at`

Las politicas RLS deben aislar datos entre organizaciones. Un usuario solo debe acceder a informacion de organizaciones y empresas donde tenga membresia activa y permisos suficientes.

Las consultas del frontend no deben depender de filtros manuales como unica barrera de seguridad. El aislamiento real debe vivir en la base de datos mediante RLS.

## 7. Modelo de monetizacion futuro

Planes iniciales propuestos:

- `Basico`: para empresas pequenas o uso inicial.
- `Profesional`: para firmas contables, equipos pequenos y empresas con mayor volumen documental.
- `Empresarial`: para organizaciones con multiples empresas, usuarios avanzados, integraciones y soporte prioritario.

Limites posibles por plan:

- cantidad de empresas
- cantidad de usuarios
- documentos IA por mes
- almacenamiento
- reportes premium
- automatizaciones
- integraciones bancarias

La suscripcion debe pertenecer a una organizacion. Los limites deben evaluarse a nivel organizacion y, cuando aplique, por empresa.

## 8. Roadmap tecnico

### FASE 1: UI premium mock

Construir la base visual del sistema, navegacion, dashboards y modulos simulados sin backend.

### FASE 2: Supabase Auth

Agregar autenticacion, perfiles de usuario y proteccion inicial de rutas.

### FASE 3: modelo multiempresa

Crear organizaciones, miembros, empresas administradas y permisos por rol.

### FASE 4: documentos y storage

Implementar carga real de archivos, storage, metadata y estados de procesamiento.

### FASE 5: lectura IA

Conectar servicios de IA para lectura de facturas, extraccion de campos y sugerencias.

### FASE 6: validacion contable

Crear flujos para revision, clasificacion, aprobacion y correccion de datos.

### FASE 7: reportes premium

Generar reportes financieros, exportes y dashboards por empresa u organizacion.

### FASE 8: suscripciones y pagos

Conectar planes, limites, facturacion, pagos y estados de suscripcion.

### FASE 9: portal cliente

Crear acceso controlado para clientes, consulta de documentos, movimientos y reportes.

### FASE 10: PWA / app movil

Optimizar experiencia movil, notificaciones, instalacion y flujos operativos ligeros.
