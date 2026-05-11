"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icons";
import { navigationItems } from "@/lib/navigation";

const navigationGroups = [
  "Principal",
  "Operacion",
  "Control mensual",
  "Sistema",
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-white/[0.08] bg-[#05070d]/92 px-3 py-3.5 backdrop-blur-xl lg:flex lg:flex-col">
      <Link
        className="group flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-2.5 py-2"
        href="/dashboard"
      >
        <div className="grid h-8 w-8 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-[11px] font-semibold text-cyan-100 shadow-[0_0_32px_rgba(34,211,238,0.14)]">
          OM7
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-5 text-white">
            OM7 Finance OS
          </p>
          <p className="truncate text-[10px] leading-4 text-slate-300/85">
            Flujo contable simple
          </p>
          <p className="text-[8.5px] font-medium uppercase tracking-[0.18em] text-cyan-200/70">
            by April7th
          </p>
        </div>
      </Link>

      <nav className="om7-scrollbar mt-4 flex flex-1 flex-col gap-2.5 overflow-y-auto pr-1">
        {navigationGroups.map((group) => {
          const items = navigationItems.filter((item) => item.group === group);

          return (
            <div className="space-y-0.5" key={group}>
              <p className="px-2.5 pb-0.5 text-[8.5px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                {group}
              </p>
              {items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    className={[
                      "group flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[12.5px] font-medium transition",
                      active
                        ? "bg-white/[0.09] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                        : "text-slate-400 hover:bg-white/[0.055] hover:text-slate-100",
                    ].join(" ")}
                    href={item.href}
                    key={item.href}
                  >
                    <span
                      className={[
                        "grid h-6.5 w-6.5 shrink-0 place-items-center rounded-lg border transition",
                        active
                          ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-100"
                          : "border-white/[0.06] bg-white/[0.03] text-slate-500 group-hover:text-slate-200",
                      ].join(" ")}
                    >
                      <Icon name={item.icon} className="h-3.5 w-3.5" />
                    </span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="mt-2 border-t border-white/[0.07] pt-2.5">
        <div className="rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.03] p-2.5 shadow-2xl shadow-black/20">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-slate-400">
                Modo operativo
              </p>
              <p className="mt-1 text-[11px] font-medium text-slate-100">
                Bandeja, revision y cierre.
              </p>
            </div>
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.9)]" />
          </div>
        </div>
        <p className="mt-2 px-2 text-[9px] font-medium uppercase tracking-[0.18em] text-slate-600">
          © April7th
        </p>
      </div>
    </aside>
  );
}
