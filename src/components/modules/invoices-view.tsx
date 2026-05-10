import {
  intelligentFlow,
  invoiceMetrics,
  invoices,
} from "@/lib/module-data";
import { PremiumCard } from "@/components/ui/premium-card";
import {
  MetricCard,
  ModuleFrame,
  ModuleHeader,
  StatusBadge,
} from "@/components/modules/shared";

export function InvoicesView() {
  return (
    <ModuleFrame>
      <ModuleHeader
        title="Facturas"
        description="Administre facturas registradas, creadas manualmente o generadas desde documentos XML procesados."
        action={
          <button
            type="button"
            className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-2.5 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/15"
          >
            Nueva carga
          </button>
        }
      />

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <PremiumCard className="flex min-h-72 flex-col items-center justify-center border-dashed border-cyan-200/20 p-8 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-100 shadow-[0_0_36px_rgba(34,211,238,0.16)]">
            <span className="text-2xl">+</span>
          </div>
          <h3 className="mt-5 text-xl font-semibold text-white">
            Arrastra una factura aquí
          </h3>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
            Zona visual preparada para subir documentos. Más adelante conectará
            OCR, validaciones y almacenamiento.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs text-slate-500">
            <span className="rounded-full border border-white/[0.08] px-3 py-1">
              PDF
            </span>
            <span className="rounded-full border border-white/[0.08] px-3 py-1">
              JPG / PNG
            </span>
            <span className="rounded-full border border-white/[0.08] px-3 py-1">
              XML
            </span>
          </div>
        </PremiumCard>

        <PremiumCard className="p-5">
          <p className="text-sm font-medium text-white">Flujo inteligente</p>
          <p className="mt-1 text-xs text-slate-500">
            Proceso preparado para automatización asistida.
          </p>
          <div className="mt-6 space-y-4">
            {intelligentFlow.map((step, index) => (
              <div key={step} className="flex gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-sm font-semibold text-cyan-100">
                  {index + 1}
                </div>
                <div className="rounded-xl border border-white/[0.07] bg-black/15 px-4 py-3">
                  <p className="text-sm font-medium text-slate-100">{step}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Etapa visual lista para conectar reglas y servicios.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </PremiumCard>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {invoiceMetrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <PremiumCard className="overflow-hidden">
        <div className="border-b border-white/[0.07] px-5 py-4">
          <p className="text-sm font-medium text-white">Facturas recientes</p>
          <p className="mt-1 text-xs text-slate-500">
            Datos mock para validar la experiencia del módulo.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-slate-600">
              <tr>
                <th className="px-5 py-3 font-medium">Proveedor</th>
                <th className="px-5 py-3 font-medium">Fecha</th>
                <th className="px-5 py-3 font-medium">Archivo</th>
                <th className="px-5 py-3 font-medium">Monto</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Confianza IA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {invoices.map((invoice) => (
                <tr key={`${invoice.provider}-${invoice.date}`}>
                  <td className="px-5 py-4 font-medium text-white">
                    {invoice.provider}
                  </td>
                  <td className="px-5 py-4 text-slate-400">{invoice.date}</td>
                  <td className="px-5 py-4 text-slate-400">
                    {invoice.fileType}
                  </td>
                  <td className="px-5 py-4 font-medium text-slate-200">
                    {invoice.amount}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge>{invoice.status}</StatusBadge>
                  </td>
                  <td className="px-5 py-4 text-cyan-100">
                    {invoice.confidence}
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
