import type { NavItem } from "@/types/navigation";

export const navigationItems: NavItem[] = [
  { group: "Principal", label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  { group: "Principal", label: "Bandeja diaria", href: "/bandeja", icon: "inbox" },
  { group: "Principal", label: "Consulta documentos", href: "/documentos", icon: "documents" },
  { group: "Principal", label: "Gmail XML", href: "/gmail-xml", icon: "inbox" },
  { group: "Operacion", label: "Compras", href: "/compras", icon: "expenses" },
  { group: "Operacion", label: "Ventas", href: "/facturas", icon: "invoice" },
  { group: "Operacion", label: "Proveedores/Clientes", href: "/contrapartes", icon: "companies" },
  { group: "Operacion", label: "Clientes/Empresas", href: "/empresas", icon: "companies" },
  { group: "Control mensual", label: "Periodos", href: "/periodos", icon: "reports" },
  { group: "Control mensual", label: "Tributario", href: "/tributario", icon: "reports" },
  { group: "Control mensual", label: "Reportes", href: "/reportes", icon: "reports" },
  { group: "Control mensual", label: "Contabilidad", href: "/contabilidad", icon: "reports" },
  { group: "Control mensual", label: "Movimientos", href: "/movimientos", icon: "expenses" },
  { group: "Sistema", label: "Configuracion", href: "/configuracion", icon: "settings" },
];
