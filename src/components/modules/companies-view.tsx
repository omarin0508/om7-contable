import { companies, companyMetrics } from "@/lib/module-data";
import { PremiumCard } from "@/components/ui/premium-card";
import {
  MetricCard,
  ModuleFrame,
  ModuleHeader,
  StatusBadge,
} from "@/components/modules/shared";

export function CompaniesView() {
  return (
    <ModuleFrame>
      <ModuleHeader
        title="Empresas y Clientes"
        description="Administración visual para entidades, clientes contables y documentación procesada."
        action={
          <button
            type="button"
            className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-2.5 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/15"
          >
            Nueva empresa
          </button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {companyMetrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <PremiumCard className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <div>
            <p className="text-sm font-medium text-white">
              Directorio empresarial
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Empresas, clientes y estado operativo.
            </p>
          </div>
          <span className="hidden rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-slate-400 sm:inline-flex">
            Multiempresa
          </span>
        </div>
        <div className="om7-responsive-table">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-slate-600">
              <tr>
                <th className="px-5 py-3 font-medium">Empresa</th>
                <th className="px-5 py-3 font-medium">Identificación</th>
                <th className="px-5 py-3 font-medium">Segmento</th>
                <th className="px-5 py-3 font-medium">Documentos</th>
                <th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {companies.map((company) => (
                <tr key={company.taxId}>
                  <td className="px-5 py-4 font-medium text-white">
                    {company.name}
                  </td>
                  <td className="px-5 py-4 text-slate-400">{company.taxId}</td>
                  <td className="px-5 py-4 text-slate-400">
                    {company.segment}
                  </td>
                  <td className="px-5 py-4 font-medium text-slate-200">
                    {company.documents}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge>{company.status}</StatusBadge>
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
