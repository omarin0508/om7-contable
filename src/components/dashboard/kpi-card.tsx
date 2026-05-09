import type { KPI } from "@/types/finance";
import { PremiumCard } from "@/components/ui/premium-card";

type KPICardProps = {
  item: KPI;
};

export function KPICard({ item }: KPICardProps) {
  const positive = item.trend === "up";

  return (
    <PremiumCard className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">{item.label}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-white">
            {item.value}
          </p>
        </div>
        <span
          className={[
            "rounded-full border px-2.5 py-1 text-xs font-medium",
            positive
              ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"
              : "border-slate-300/15 bg-slate-300/10 text-slate-300",
          ].join(" ")}
        >
          {item.change}
        </span>
      </div>
      <p className="mt-5 text-xs text-slate-500">{item.detail}</p>
    </PremiumCard>
  );
}
