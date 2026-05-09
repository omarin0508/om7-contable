import type { Alert, KPI, Movement } from "@/types/finance";

export const kpis: KPI[] = [
  {
    label: "Ingresos",
    value: "$184,920",
    change: "+12.4%",
    trend: "up",
    detail: "vs. mes anterior",
  },
  {
    label: "Gastos",
    value: "$72,480",
    change: "-3.8%",
    trend: "up",
    detail: "optimizacion operativa",
  },
  {
    label: "Flujo de Caja",
    value: "$112,440",
    change: "+18.1%",
    trend: "up",
    detail: "proyeccion 30 dias",
  },
  {
    label: "Facturas Procesadas",
    value: "1,248",
    change: "96.8%",
    trend: "neutral",
    detail: "automatizacion estimada",
  },
];

export const movements: Movement[] = [
  {
    company: "Northstar Holdings",
    category: "Ingreso recurrente",
    amount: "+$24,600",
    status: "Conciliado",
    date: "Hoy",
  },
  {
    company: "Atlas Cloud Services",
    category: "Infraestructura",
    amount: "-$8,920",
    status: "Pendiente",
    date: "Ayer",
  },
  {
    company: "Mercury Logistics",
    category: "Compras",
    amount: "-$13,140",
    status: "Revision",
    date: "May 07",
  },
  {
    company: "OM7 Advisory",
    category: "Servicios profesionales",
    amount: "+$31,500",
    status: "Conciliado",
    date: "May 06",
  },
];

export const alerts: Alert[] = [
  {
    title: "Variacion inusual en gastos",
    description: "Infraestructura subio 21% sobre el promedio trimestral.",
    priority: "Alta",
  },
  {
    title: "Facturas por validar",
    description: "18 documentos requieren revision antes del cierre.",
    priority: "Media",
  },
  {
    title: "Caja saludable",
    description: "Cobertura operativa estimada para 7.8 meses.",
    priority: "Baja",
  },
];

export const activity = [
  { label: "Ene", value: 42 },
  { label: "Feb", value: 58 },
  { label: "Mar", value: 49 },
  { label: "Abr", value: 72 },
  { label: "May", value: 66 },
  { label: "Jun", value: 84 },
  { label: "Jul", value: 78 },
  { label: "Ago", value: 91 },
];
