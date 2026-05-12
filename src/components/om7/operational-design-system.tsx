import type { ReactNode } from "react";
import Link from "next/link";
import { AssistantFloatingButton } from "@/components/assistant/assistant-floating-button";
import { PremiumCard } from "@/components/ui/premium-card";

type Tone = "amber" | "cyan" | "emerald" | "rose" | "slate";

const toneClasses: Record<
  Tone,
  {
    badge: string;
    card: string;
    icon: string;
  }
> = {
  amber: {
    badge: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    card: "border-amber-200/14 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.1),transparent_34%),rgba(255,255,255,0.035)]",
    icon: "border-amber-200/20 bg-amber-300/[0.08] text-amber-100",
  },
  cyan: {
    badge: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
    card: "border-cyan-200/14 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.1),transparent_34%),rgba(255,255,255,0.035)]",
    icon: "border-cyan-200/20 bg-cyan-300/[0.08] text-cyan-100",
  },
  emerald: {
    badge: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
    card: "border-emerald-200/14 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.1),transparent_34%),rgba(255,255,255,0.035)]",
    icon: "border-emerald-200/20 bg-emerald-300/[0.08] text-emerald-100",
  },
  rose: {
    badge: "border-rose-300/20 bg-rose-300/10 text-rose-100",
    card: "border-rose-200/14 bg-[radial-gradient(circle_at_top_right,rgba(251,113,133,0.1),transparent_34%),rgba(255,255,255,0.035)]",
    icon: "border-rose-200/20 bg-rose-300/[0.08] text-rose-100",
  },
  slate: {
    badge: "border-white/[0.1] bg-white/[0.045] text-slate-200",
    card: "border-white/[0.09] bg-[radial-gradient(circle_at_top_right,rgba(148,163,184,0.08),transparent_34%),rgba(255,255,255,0.032)]",
    icon: "border-white/[0.12] bg-white/[0.055] text-slate-200",
  },
};

export function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-4 sm:gap-5">
      {children}
    </div>
  );
}

export function WorkspacePanel({
  children,
  className = "",
  tone = "slate",
}: {
  children: ReactNode;
  className?: string;
  tone?: Tone;
}) {
  return (
    <PremiumCard className={`${toneClasses[tone].card} ${className}`}>
      {children}
    </PremiumCard>
  );
}

export function DashboardHero({
  action,
  badge,
  description,
  eyebrow = "OM7 Finance OS",
  title,
}: {
  action?: ReactNode;
  badge?: ReactNode;
  description: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <section className="om7-card om7-panel-safe rounded-3xl border-white/[0.09] bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_34%),rgba(255,255,255,0.035)] p-4 shadow-2xl shadow-black/20 sm:p-6 lg:p-7">
      <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80 sm:text-xs sm:tracking-[0.24em]">
              {eyebrow}
            </p>
            {badge}
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:mt-4 sm:text-3xl lg:text-4xl">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
            {description}
          </p>
        </div>
        {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
      </div>
    </section>
  );
}

export function WorkspaceHeader(props: Parameters<typeof DashboardHero>[0]) {
  return <DashboardHero {...props} />;
}

export function ContextualHelpCard({
  actions,
  children,
  title = "Ayuda OM7",
  tone = "cyan",
}: {
  actions?: ReactNode;
  children: ReactNode;
  title?: string;
  tone?: Tone;
}) {
  return (
    <WorkspacePanel className="p-5" tone={tone}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-base font-semibold text-white">{title}</p>
          <div className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            {children}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </WorkspacePanel>
  );
}

export function KPIStatCard({
  detail,
  label,
  tone = "slate",
  value,
}: {
  detail: string;
  label: string;
  tone?: Tone;
  value: string;
}) {
  return (
    <WorkspacePanel className="p-4 transition hover:-translate-y-0.5 hover:bg-white/[0.045] sm:p-5" tone={tone}>
      <p className="text-sm text-slate-300">{label}</p>
      <p className="mt-3 break-words text-xl font-semibold tracking-tight text-white sm:text-2xl">{value}</p>
      <p className="mt-4 text-xs leading-5 text-slate-500">{detail}</p>
    </WorkspacePanel>
  );
}

export function OperationalCard({
  count,
  description,
  href,
  icon = "OM7",
  label,
  title,
  tone = "cyan",
  value,
}: {
  count?: string;
  description?: string;
  href: string;
  icon?: ReactNode;
  label: string;
  title: string;
  tone?: Tone;
  value: string;
}) {
  return (
    <WorkspacePanel
      className="group overflow-hidden p-0 shadow-xl shadow-black/20 transition hover:-translate-y-0.5 hover:bg-white/[0.045] hover:shadow-2xl"
      tone={tone}
    >
      <Link className="block p-4 sm:p-5" href={href}>
        <div className="flex items-start justify-between gap-4">
          <span className={`grid h-11 w-11 place-items-center rounded-2xl border text-sm font-semibold ${toneClasses[tone].icon}`}>
            {icon}
          </span>
          {count ? (
            <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">
              {count}
            </span>
          ) : null}
        </div>
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {label}
          </p>
          <h2 className="mt-2 text-base font-semibold text-white sm:text-lg">{title}</h2>
          <p className="mt-3 break-words text-xl font-semibold tracking-tight text-white sm:text-2xl">
            {value}
          </p>
          {description ? (
            <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
          ) : null}
        </div>
        <div className={`mt-5 inline-flex rounded-xl border px-3 py-2 text-xs font-semibold transition ${toneClasses[tone].badge}`}>
          Entrar
        </div>
      </Link>
    </WorkspacePanel>
  );
}

export function StatusBadge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return <span className={`om7-chip ${toneClasses[tone].badge}`}>{children}</span>;
}

export function E7ConfidenceBadge({ value }: { value: number | null | undefined }) {
  const numeric = Number(value ?? 0);
  const tone: Tone = numeric >= 0.85 ? "emerald" : numeric >= 0.65 ? "amber" : "rose";
  const label = numeric >= 0.85 ? "Alta" : numeric >= 0.65 ? "Media" : "Baja";

  return (
    <StatusBadge tone={tone}>
      {label} · {Math.round(numeric * 100)}%
    </StatusBadge>
  );
}

export function EmptyStateOM7({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <WorkspacePanel className="border-dashed p-10 text-center">
      <p className="text-lg font-semibold text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">
        {description}
      </p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </WorkspacePanel>
  );
}

export function QuickActionsBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-2 sm:flex-row sm:flex-wrap">
      {children}
    </div>
  );
}

export function SectionHeader({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-base font-semibold text-white">{title}</p>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function WorkspaceSidebar({ children }: { children: ReactNode }) {
  return <aside className="space-y-5">{children}</aside>;
}

export function WorkspaceChecklist({
  items,
}: {
  items: Array<{ done?: boolean; label: string }>;
}) {
  return (
    <WorkspacePanel className="p-5">
      <p className="text-base font-semibold text-white">Checklist operativo</p>
      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <div
            className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-black/15 px-3 py-2 text-sm text-slate-300"
            key={item.label}
          >
            <span
              className={[
                "grid h-5 w-5 place-items-center rounded-full border text-[10px]",
                item.done
                  ? "border-emerald-300/30 bg-emerald-300/15 text-emerald-100"
                  : "border-white/[0.12] bg-white/[0.04] text-slate-500",
              ].join(" ")}
            >
              {item.done ? "OK" : ""}
            </span>
            {item.label}
          </div>
        ))}
      </div>
    </WorkspacePanel>
  );
}

export { AssistantFloatingButton as FloatingAssistantButton };
