import type { ReactNode } from "react";
import { PremiumCard } from "@/components/ui/premium-card";

type ModuleHeaderProps = {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
};

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
};

type StatusBadgeProps = {
  children: ReactNode;
};

export function ModuleHeader({
  eyebrow = "OM7 Finance OS",
  title,
  description,
  action,
}: ModuleHeaderProps) {
  return (
    <section className="flex flex-col gap-5 rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.08] via-white/[0.04] to-cyan-300/[0.035] p-6 shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-7 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
          {eyebrow}
        </p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {title}
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
          {description}
        </p>
      </div>
      {action}
    </section>
  );
}

export function MetricCard({ label, value, detail }: MetricCardProps) {
  return (
    <PremiumCard className="p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-white">
        {value}
      </p>
      <p className="mt-4 text-xs text-slate-500">{detail}</p>
    </PremiumCard>
  );
}

export function StatusBadge({ children }: StatusBadgeProps) {
  const text = String(children);
  const tone =
    text.includes("Error") || text.includes("Alta")
      ? "border-rose-300/20 bg-rose-300/10 text-rose-200"
      : text.includes("Pendiente") ||
          text.includes("Validar") ||
          text.includes("Revisión")
        ? "border-amber-300/20 bg-amber-300/10 text-amber-200"
        : text.includes("Próximamente")
          ? "border-slate-300/15 bg-slate-300/10 text-slate-300"
          : "border-emerald-300/20 bg-emerald-300/10 text-emerald-200";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${tone}`}>
      {children}
    </span>
  );
}

export function ModuleFrame({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">{children}</div>;
}
