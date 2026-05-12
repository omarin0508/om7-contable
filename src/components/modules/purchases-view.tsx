import {
  purchaseCategories,
  purchaseMetrics,
  purchases,
} from "@/lib/module-data";
import { PremiumCard } from "@/components/ui/premium-card";
import {
  MetricCard,
  ModuleFrame,
  ModuleHeader,
  StatusBadge,
} from "@/components/modules/shared";

export function PurchasesView() {
  return (
    <ModuleFrame>
      <ModuleHeader
        title="Compras y Gastos"
        description="Control visual de egresos, proveedores, categorías y pendientes por pagar."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {purchaseMetrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <PremiumCard className="p-5">
          <p className="text-sm font-medium text-white">Filtros</p>
          <div className="mt-5 space-y-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                Categoría
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {["Todas", "Infraestructura", "Operaciones", "Servicios"].map(
                  (filter) => (
                    <button
                      key={filter}
                      type="button"
                      className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                    >
                      {filter}
                    </button>
                  ),
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                Estado
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {["Pendiente", "Aprobado", "Pagado", "Revisión"].map(
                  (filter) => (
                    <button
                      key={filter}
                      type="button"
                      className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                    >
                      {filter}
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>
        </PremiumCard>

        <div className="grid gap-4 sm:grid-cols-2">
          {purchaseCategories.map((category) => (
            <PremiumCard key={category.label} className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white">
                  {category.label}
                </p>
                <span className="text-xs text-slate-500">{category.share}</span>
              </div>
              <p className="mt-4 text-2xl font-semibold text-white">
                {category.value}
              </p>
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300"
                  style={{ width: category.share }}
                />
              </div>
            </PremiumCard>
          ))}
        </div>
      </section>

      <PremiumCard className="overflow-hidden">
        <div className="border-b border-white/[0.07] px-5 py-4">
          <p className="text-sm font-medium text-white">Compras recientes</p>
          <p className="mt-1 text-xs text-slate-500">
            Vista inicial para seguimiento de egresos y proveedores.
          </p>
        </div>
        <div className="om7-responsive-table">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-slate-600">
              <tr>
                <th className="px-5 py-3 font-medium">Proveedor</th>
                <th className="px-5 py-3 font-medium">Categoría</th>
                <th className="px-5 py-3 font-medium">Monto</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Frecuencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {purchases.map((purchase) => (
                <tr key={purchase.provider}>
                  <td className="px-5 py-4 font-medium text-white">
                    {purchase.provider}
                  </td>
                  <td className="px-5 py-4 text-slate-400">
                    {purchase.category}
                  </td>
                  <td className="px-5 py-4 font-medium text-slate-200">
                    {purchase.amount}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge>{purchase.status}</StatusBadge>
                  </td>
                  <td className="px-5 py-4 text-slate-500">
                    {purchase.frequency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PremiumCard>
    </ModuleFrame>
  );
}
