import type { ReactNode } from "react";
import Link from "next/link";
import {
  DashboardHero,
  KPIStatCard,
  StatusBadge as OM7StatusBadge,
  WorkspaceLayout,
} from "@/components/om7/operational-design-system";

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
    <DashboardHero
      action={action}
      description={description}
      eyebrow={eyebrow}
      title={title}
    />
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
  return <KPIStatCard detail={detail} label={label} value={value} />;
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

  if (tone === "om7-chip-rose") {
    return <OM7StatusBadge tone="rose">{children}</OM7StatusBadge>;
  }

  if (tone === "om7-chip-amber") {
    return <OM7StatusBadge tone="amber">{children}</OM7StatusBadge>;
  }

  if (tone === "om7-chip-cyan") {
    return <OM7StatusBadge tone="cyan">{children}</OM7StatusBadge>;
  }

  return <OM7StatusBadge tone="emerald">{children}</OM7StatusBadge>;
}

export function ModuleFrame({ children }: { children: ReactNode }) {
  return <WorkspaceLayout>{children}</WorkspaceLayout>;
}
