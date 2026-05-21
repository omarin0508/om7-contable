"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const accountingNavItems = [
  { href: "/contabilidad", label: "Resumen" },
  { href: "/contabilidad/asientos", label: "Asientos" },
  { href: "/contabilidad/mayor", label: "Mayor" },
  { href: "/contabilidad/balance-comprobacion", label: "Balance" },
  { href: "/contabilidad/estados-financieros", label: "Estados" },
  { href: "/contabilidad/reportes", label: "Reportes" },
  { href: "/contabilidad/catalogo", label: "Catalogo" },
  { href: "/contabilidad/flujo-efectivo", label: "Flujo" },
  { href: "/contabilidad/cierres", label: "Cierres" },
  { href: "/contabilidad/reglas", label: "Reglas" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/contabilidad") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AccountingWorkspaceNav() {
  const pathname = usePathname();

  if (!pathname || !pathname.startsWith("/contabilidad")) {
    return null;
  }

  return (
    <nav
      aria-label="Navegacion contable"
      className="rounded-2xl border border-white/20 bg-[#06101c] p-2 shadow-2xl shadow-cyan-950/25 ring-1 ring-cyan-300/10"
    >
      <div className="flex min-w-0 items-center gap-2 overflow-x-auto om7-scrollbar">
        <div className="flex shrink-0 items-center gap-2">
          {accountingNavItems.map((item) => {
            const active = isActivePath(pathname, item.href);

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={[
                  "grid h-10 shrink-0 place-items-center rounded-xl border px-3.5 text-sm font-semibold transition",
                  "focus:outline-none focus:ring-2 focus:ring-cyan-400/30",
                  active
                    ? "border-cyan-300/35 bg-cyan-300/12 text-cyan-50 shadow-lg shadow-cyan-950/30"
                    : "border-white/10 bg-white/[0.035] text-slate-300 hover:border-cyan-200/25 hover:bg-cyan-300/[0.08] hover:text-cyan-100",
                ].join(" ")}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
