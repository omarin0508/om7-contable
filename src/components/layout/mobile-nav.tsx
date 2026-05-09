"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationItems } from "@/lib/navigation";
import { Icon } from "@/components/ui/icons";

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-6 gap-1 rounded-2xl border border-white/[0.1] bg-[#05070d]/90 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl lg:hidden">
      {navigationItems.map((item) => {
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            className={[
              "grid h-11 place-items-center rounded-xl transition",
              active
                ? "bg-white/[0.1] text-cyan-100"
                : "text-slate-500 hover:bg-white/[0.06] hover:text-slate-200",
            ].join(" ")}
          >
            <Icon name={item.icon} className="h-4.5 w-4.5" />
          </Link>
        );
      })}
    </nav>
  );
}
