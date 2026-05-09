export const invoiceMetrics = [
  { label: "Pendientes de validar", value: "34", detail: "12 con prioridad alta" },
  { label: "Procesadas hoy", value: "186", detail: "PDF, imagen y XML" },
  { label: "Confianza promedio IA", value: "94.2%", detail: "sobre campos clave" },
  { label: "Errores detectados", value: "7", detail: "requieren revisión" },
];

export const invoices = [
  {
    provider: "Grupo Altea",
    date: "09 May 2026",
    fileType: "PDF",
    amount: "$4,280.00",
    status: "Validar",
    confidence: "91%",
  },
  {
    provider: "Atlas Cloud Services",
    date: "09 May 2026",
    fileType: "XML",
    amount: "$8,920.00",
    status: "Procesada",
    confidence: "98%",
  },
  {
    provider: "Mercury Logistics",
    date: "08 May 2026",
    fileType: "Imagen",
    amount: "$1,340.50",
    status: "Error",
    confidence: "76%",
  },
  {
    provider: "Northstar Holdings",
    date: "08 May 2026",
    fileType: "PDF",
    amount: "$12,640.00",
    status: "Procesada",
    confidence: "96%",
  },
];

export const intelligentFlow = [
  "Subir documento",
  "Extraer datos",
  "Clasificar gasto",
  "Validar y guardar",
];

export const purchaseMetrics = [
  { label: "Gasto del mes", value: "$72,480", detail: "+4.8% vs abril" },
  { label: "Proveedores activos", value: "42", detail: "8 estratégicos" },
  { label: "Gastos recurrentes", value: "$18,260", detail: "25.2% del total" },
  { label: "Pendientes por pagar", value: "$9,740", detail: "próximos 7 días" },
];

export const purchases = [
  {
    provider: "Atlas Cloud Services",
    category: "Infraestructura",
    amount: "$8,920",
    status: "Pendiente",
    frequency: "Recurrente",
  },
  {
    provider: "Mercury Logistics",
    category: "Operaciones",
    amount: "$13,140",
    status: "Aprobado",
    frequency: "Variable",
  },
  {
    provider: "Studio Norte",
    category: "Marketing",
    amount: "$3,820",
    status: "Revisión",
    frequency: "Variable",
  },
  {
    provider: "Legal Partners",
    category: "Servicios",
    amount: "$6,400",
    status: "Pagado",
    frequency: "Mensual",
  },
];

export const purchaseCategories = [
  { label: "Infraestructura", value: "$22,400", share: "31%" },
  { label: "Operaciones", value: "$18,960", share: "26%" },
  { label: "Servicios", value: "$15,320", share: "21%" },
  { label: "Marketing", value: "$9,870", share: "14%" },
];

export const reports = [
  {
    title: "Flujo de Caja",
    description: "Proyección ejecutiva de entradas, salidas y runway.",
    type: "Dashboard",
    status: "Disponible",
  },
  {
    title: "Compras por Proveedor",
    description: "Concentración de gasto, recurrencia y variaciones.",
    type: "Excel",
    status: "Disponible",
  },
  {
    title: "IVA / Impuestos",
    description: "Resumen fiscal preparado para revisión contable.",
    type: "PDF",
    status: "Próximamente",
  },
  {
    title: "Balance Ejecutivo",
    description: "Lectura financiera para dirección y juntas internas.",
    type: "Dashboard",
    status: "Disponible",
  },
  {
    title: "Cuentas por Pagar",
    description: "Vencimientos, prioridades y exposición de caja.",
    type: "Excel",
    status: "Disponible",
  },
  {
    title: "Centros de Costo",
    description: "Distribución operacional por área, cliente o unidad.",
    type: "PDF",
    status: "Próximamente",
  },
];

export const companyMetrics = [
  { label: "Empresas activas", value: "18", detail: "multiempresa listo" },
  { label: "Clientes contables", value: "126", detail: "cartera consolidada" },
  { label: "Documentos procesados", value: "14.8k", detail: "últimos 90 días" },
  { label: "Última sincronización", value: "Hace 8 min", detail: "estado operativo" },
];

export const companies = [
  {
    name: "OM7 Advisory",
    taxId: "3-101-884220",
    segment: "Servicios",
    documents: "2,840",
    status: "Activo",
  },
  {
    name: "Northstar Holdings",
    taxId: "3-102-442910",
    segment: "Inversiones",
    documents: "1,926",
    status: "Revisión",
  },
  {
    name: "Mercury Logistics",
    taxId: "3-101-672401",
    segment: "Operaciones",
    documents: "4,108",
    status: "Activo",
  },
  {
    name: "Atlas Cloud Services",
    taxId: "3-102-991304",
    segment: "Tecnología",
    documents: "862",
    status: "Pendiente",
  },
];

export const settingsSections = [
  {
    title: "Perfil",
    description: "Datos del usuario, preferencias de idioma y experiencia.",
    status: "Base lista",
  },
  {
    title: "Empresa principal",
    description: "Información fiscal, moneda, país y parámetros operativos.",
    status: "Pendiente",
  },
  {
    title: "Categorías contables",
    description: "Estructura inicial para clasificar compras, gastos e ingresos.",
    status: "Base lista",
  },
  {
    title: "Automatizaciones IA",
    description: "Reglas futuras para lectura, sugerencias y validaciones.",
    status: "Próximamente",
  },
  {
    title: "Integraciones futuras",
    description: "Bancos, facturación electrónica, ERP y almacenamiento.",
    status: "Próximamente",
  },
  {
    title: "Seguridad",
    description: "Roles, auditoría, sesiones y controles de acceso.",
    status: "Diseño",
  },
];
