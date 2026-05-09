import { reports } from "@/lib/module-data";
import { PremiumCard } from "@/components/ui/premium-card";
import { ModuleFrame, ModuleHeader, StatusBadge } from "@/components/modules/shared";

export function ReportsView() {
  return (
    <ModuleFrame>
      <ModuleHeader
        title="Reportes Premium"
        description="Biblioteca ejecutiva de reportes financieros lista para exportaciones, análisis y tableros conectados."
      />

      <PremiumCard className="overflow-hidden p-6 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
              Exportes nivel OM7
            </p>
            <h3 className="mt-4 text-2xl font-semibold tracking-tight text-white">
              Reportes preparados para dirección, contabilidad y operación.
            </h3>
            <p className="mt-4 text-sm leading-6 text-slate-400">
              Esta base visual contempla exportes PDF, Excel y dashboards para
              que cada módulo pueda convertirse luego en producto conectado.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {["PDF", "Excel", "Dashboard"].map((type) => (
              <div
                key={type}
                className="rounded-2xl border border-white/[0.07] bg-black/15 p-4 text-center"
              >
                <p className="text-lg font-semibold text-white">{type}</p>
                <p className="mt-2 text-xs text-slate-500">Formato</p>
              </div>
            ))}
          </div>
        </div>
      </PremiumCard>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => (
          <PremiumCard key={report.title} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="grid h-11 w-11 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-sm font-semibold text-cyan-100">
                {report.type.slice(0, 2)}
              </div>
              <StatusBadge>{report.status}</StatusBadge>
            </div>
            <h3 className="mt-5 text-lg font-semibold text-white">
              {report.title}
            </h3>
            <p className="mt-3 min-h-12 text-sm leading-6 text-slate-400">
              {report.description}
            </p>
            <div className="mt-5 flex items-center justify-between border-t border-white/[0.07] pt-4">
              <span className="text-xs text-slate-500">Tipo</span>
              <span className="text-xs font-medium text-slate-200">
                {report.type}
              </span>
            </div>
          </PremiumCard>
        ))}
      </section>
    </ModuleFrame>
  );
}
