"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationItems } from "@/lib/navigation";
import { Icon } from "@/components/ui/icons";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-white/[0.08] bg-[#05070d]/90 px-4 py-5 backdrop-blur-xl lg:flex lg:flex-col">
      <Link
        href="/dashboard"
        className="group flex items-center gap-3 rounded-2xl px-3 py-2.5"
      >
        <div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-sm font-semibold text-cyan-100 shadow-[0_0_32px_rgba(34,211,238,0.14)]">
          OM7
        </div>
        <div>
          <p className="text-sm font-semibold text-white">OM7 Finance OS</p>
          <p className="text-xs text-slate-500">Intelligent finance suite</p>
        </div>
      </Link>

      <nav className="mt-8 flex flex-1 flex-col gap-1.5">
        {navigationItems.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-white/[0.09] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  : "text-slate-400 hover:bg-white/[0.055] hover:text-slate-100",
              ].join(" ")}
            >
              <span
                className={[
                  "grid h-8 w-8 place-items-center rounded-lg border transition",
                  active
                    ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-100"
                    : "border-white/[0.06] bg-white/[0.03] text-slate-500 group-hover:text-slate-200",
                ].join(" ")}
              >
                <Icon name={item.icon} className="h-4 w-4" />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 shadow-2xl shadow-black/20">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
            Cierre mensual
          </p>
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.9)]" />
        </div>
        <p className="mt-3 text-sm font-medium text-slate-100">88% listo</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
          <div className="h-full w-[88%] rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300" />
        </div>
      </div>
    </aside>
  );
}
