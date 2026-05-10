import { ActivityChart } from "@/components/dashboard/activity-chart";
import { AlertsCard } from "@/components/dashboard/alerts-card";
import { KPICard } from "@/components/dashboard/kpi-card";
import { MovementsTable } from "@/components/dashboard/movements-table";
import { PremiumCard } from "@/components/ui/premium-card";
import type { ActiveContext } from "@/lib/active-context";
import { kpis } from "@/lib/dashboard-data";

type DashboardViewProps = {
  activeContext?: ActiveContext;
};

export function DashboardView({ activeContext }: DashboardViewProps) {
  const organization = activeContext?.organization;
  const activeCompany = activeContext?.activeCompany;
  const suggestedCompany = activeContext?.suggestedCompany;
  const companies = activeContext?.companies ?? [];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <section className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.08] via-white/[0.04] to-cyan-300/[0.035] p-5 shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
              OM7 Finance OS
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Control financiero ejecutivo, listo para escalar.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">
              Vista centralizada para monitorear ingresos, gastos, caja,
              documentos y senales operativas con una base visual sobria y
              preparada para producto.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/[0.08] bg-black/20 p-3 sm:min-w-80">
            <div className="rounded-xl bg-white/[0.05] p-4">
              <p className="text-xs text-slate-500">Runway</p>
              <p className="mt-2 text-xl font-semibold text-white">7.8 meses</p>
            </div>
            <div className="rounded-xl bg-white/[0.05] p-4">
              <p className="text-xs text-slate-500">Margen neto</p>
              <p className="mt-2 text-xl font-semibold text-white">24.6%</p>
            </div>
          </div>
        </div>
      </section>

      <PremiumCard className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-white">
              Empresa activa actual
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {activeCompany
                ? `${activeCompany.name} opera dentro de ${organization?.name ?? "tu organizacion"}.`
                : companies.length === 0
                  ? "Crea una empresa para empezar a registrar documentos y movimientos."
                  : "Selecciona una empresa para empezar a registrar documentos y movimientos."}
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-black/15 px-4 py-3">
            <p className="text-xs text-slate-500">
              {activeCompany ? "Contexto activo" : "Sugerencia"}
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              {activeCompany?.name ??
                suggestedCompany?.name ??
                "Sin empresa disponible"}
            </p>
          </div>
        </div>
      </PremiumCard>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <KPICard key={item.label} item={item} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.45fr_0.85fr]">
        <ActivityChart />
        <AlertsCard />
      </section>

      <MovementsTable />
    </div>
  );
}
