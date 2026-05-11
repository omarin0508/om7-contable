import type { ReactNode } from "react";
import Link from "next/link";
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
    <section className="om7-card flex flex-col gap-5 rounded-3xl p-6 sm:p-7 lg:flex-row lg:items-end lg:justify-between">
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

export function BackLink({
  href = "/dashboard",
  label = "Volver al dashboard",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <Link className="om7-btn-ghost px-4 py-2.5" href={href}>
      {label}
    </Link>
  );
}

export function MetricCard({ label, value, detail }: MetricCardProps) {
  return (
    <PremiumCard className="p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-white">
        {value}
      </p>
      <p className="om7-muted mt-4 text-xs">{detail}</p>
    </PremiumCard>
  );
}

export function StatusBadge({ children }: StatusBadgeProps) {
  const text = String(children);
  const tone =
    text.includes("Error") || text.includes("Alta")
      ? "om7-chip-rose"
      : text.includes("Pendiente") ||
          text.includes("Validar") ||
          text.includes("Revision") ||
          text.includes("Revisión") ||
          text.includes("Subido")
        ? "om7-chip-amber"
        : text.includes("Procesado") || text.includes("IA") || text.includes("XML")
          ? "om7-chip-cyan"
          : text.includes("Próximamente")
            ? ""
            : "om7-chip-emerald";

  return <span className={`om7-chip ${tone}`}>{children}</span>;
}

export function ModuleFrame({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">{children}</div>;
}
