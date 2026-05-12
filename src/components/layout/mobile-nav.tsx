"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { navigationItems } from "@/lib/navigation";
import { Icon } from "@/components/ui/icons";

export function MobileNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const primaryItems = navigationItems.filter(
    (item) => item.group === "Principal",
  ).slice(0, 3);
  const groups = Array.from(new Set(navigationItems.map((item) => item.group)));

  return (
    <>
      {isOpen ? (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            aria-label="Cerrar menu"
            className="absolute inset-0 bg-black/25"
            onClick={() => setIsOpen(false)}
            type="button"
          />
          <aside className="om7-scrollbar absolute inset-x-3 bottom-20 max-h-[72vh] overflow-y-auto rounded-3xl border border-cyan-200/15 bg-[#05070d]/98 p-3 shadow-2xl shadow-black/70">
            <Link
              className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3"
              href="/dashboard"
              onClick={() => setIsOpen(false)}
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-xs font-semibold text-cyan-100">
                OM7
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-white">
                  OM7 Finance OS
                </span>
                <span className="block text-[10px] uppercase tracking-[0.18em] text-cyan-200/70">
                  by April7th
                </span>
              </span>
            </Link>

            <div className="mt-3 grid gap-3">
              {groups.map((group) => (
                <div key={group}>
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {group}
                  </p>
                  <div className="grid gap-1.5">
                    {navigationItems
                      .filter((item) => item.group === group)
                      .map((item) => {
                        const active =
                          pathname === item.href ||
                          pathname.startsWith(`${item.href}/`);

                        return (
                          <Link
                            className={[
                              "flex min-h-11 items-center gap-3 rounded-2xl border px-3 py-2 text-sm font-semibold transition",
                              active
                                ? "border-cyan-300/22 bg-cyan-300/[0.09] text-cyan-50"
                                : "border-white/[0.06] bg-white/[0.025] text-slate-300 hover:bg-white/[0.06]",
                            ].join(" ")}
                            href={item.href}
                            key={item.href}
                            onClick={() => setIsOpen(false)}
                          >
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
                              <Icon name={item.icon} className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 truncate">{item.label}</span>
                          </Link>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      ) : null}

      <nav className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-4 gap-1 rounded-2xl border border-white/[0.1] bg-[#05070d]/92 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl lg:hidden">
        {primaryItems.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              aria-label={item.label}
              className={[
                "grid h-11 place-items-center rounded-xl transition",
                active
                  ? "bg-white/[0.1] text-cyan-100"
                  : "text-slate-500 hover:bg-white/[0.06] hover:text-slate-200",
              ].join(" ")}
              href={item.href}
              key={item.href}
            >
              <Icon name={item.icon} className="h-4.5 w-4.5" />
            </Link>
          );
        })}
        <button
          aria-expanded={isOpen}
          aria-label="Abrir menu"
          className={[
            "grid h-11 place-items-center rounded-xl transition",
            isOpen
              ? "bg-white/[0.1] text-cyan-100"
              : "text-slate-500 hover:bg-white/[0.06] hover:text-slate-200",
          ].join(" ")}
          onClick={() => setIsOpen((value) => !value)}
          type="button"
        >
          <Icon name="settings" className="h-4.5 w-4.5" />
        </button>
      </nav>
    </>
  );
}
