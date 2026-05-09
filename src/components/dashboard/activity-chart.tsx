import { activity } from "@/lib/dashboard-data";
import { PremiumCard } from "@/components/ui/premium-card";

export function ActivityChart() {
  return (
    <PremiumCard className="p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-white">Actividad financiera</p>
          <p className="mt-1 text-xs text-slate-500">
            Volumen agregado por periodo
          </p>
        </div>
        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100">
          Live preview
        </span>
      </div>

      <div className="mt-8 flex h-64 items-end gap-3">
        {activity.map((item) => (
          <div key={item.label} className="flex flex-1 flex-col items-center gap-3">
            <div className="flex h-52 w-full items-end rounded-full bg-white/[0.035] p-1">
              <div
                className="w-full rounded-full bg-gradient-to-t from-cyan-400/80 via-emerald-300/80 to-white/80 shadow-[0_0_28px_rgba(34,211,238,0.16)]"
                style={{ height: `${item.value}%` }}
              />
            </div>
            <span className="text-[11px] text-slate-500">{item.label}</span>
          </div>
        ))}
      </div>
    </PremiumCard>
  );
}
