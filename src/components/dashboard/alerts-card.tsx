import { alerts } from "@/lib/dashboard-data";
import { PremiumCard } from "@/components/ui/premium-card";

export function AlertsCard() {
  return (
    <PremiumCard className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">Alertas IA</p>
          <p className="mt-1 text-xs text-slate-500">
            Senales financieras simuladas
          </p>
        </div>
        <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-xs font-medium text-amber-100">
          3 nuevas
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.title}
            className="rounded-xl border border-white/[0.07] bg-black/15 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-100">
                {alert.title}
              </p>
              <span className="text-[11px] text-slate-500">
                {alert.priority}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {alert.description}
            </p>
          </div>
        ))}
      </div>
    </PremiumCard>
  );
}
