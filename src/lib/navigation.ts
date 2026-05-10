import type { NavItem } from "@/types/navigation";

export const navigationItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  {
    label: "Facturas Inteligentes",
    href: "/facturas",
    icon: "invoice",
  },
  { label: "Compras y Gastos", href: "/compras", icon: "expenses" },
  { label: "Documentos", href: "/documentos", icon: "documents" },
  { label: "Bandeja", href: "/bandeja", icon: "inbox" },
  { label: "Reportes", href: "/reportes", icon: "reports" },
  { label: "Empresas", href: "/empresas", icon: "companies" },
  { label: "Configuracion", href: "/configuracion", icon: "settings" },
];
