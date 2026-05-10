import Link from "next/link";
import { uploadDocumentAction } from "@/app/(platform)/documentos/actions";
import { createInvoiceAction } from "@/app/(platform)/facturas/actions";
import {
  MetricCard,
  ModuleFrame,
  ModuleHeader,
  StatusBadge,
} from "@/components/modules/shared";
import { PremiumCard } from "@/components/ui/premium-card";
import { formatCurrencyAmount } from "@/lib/currency";
import { getInvoicesForActiveCompany } from "@/lib/invoices";

const statusLabels: Record<string, string> = {
  borrador: "Borrador",
  validada: "Validada",
  revision: "Revision",
  archivada: "Archivada",
};

function formatMoney(value: number | null, currency: string | null) {
  return formatCurrencyAmount(value, currency);
}

export default async function InvoicesPage() {
  const { activeContext, invoices } = await getInvoicesForActiveCompany();
  const activeCompany = activeContext.activeCompany;
  const organization = activeContext.organization;
  const totalAmount = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.total ?? 0),
    0,
  );
  const pendingCount = invoices.filter(
    (invoice) => invoice.estado === "borrador" || invoice.estado === "revision",
  ).length;

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Facturas"
        description="Administre facturas registradas, creadas manualmente o generadas desde documentos XML procesados."
        action={
          <a
            className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-2.5 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/15"
            href="#nueva-factura"
          >
            Nueva factura
          </a>
        }
      />

      {!activeCompany ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/10 p-5">
          <p className="text-sm font-medium text-amber-100">
            Selecciona una empresa activa
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-100/75">
            Las facturas deben registrarse bajo una empresa. Ve a Empresas y
            usa el boton Usar como activa para definir el contexto de trabajo.
          </p>
          <Link
            className="mt-4 inline-flex rounded-xl border border-amber-200/20 bg-black/15 px-4 py-2 text-sm font-medium text-amber-100 transition hover:bg-black/25"
            href="/empresas"
          >
            Ir a empresas
          </Link>
        </PremiumCard>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail={activeCompany?.name ?? "Sin empresa activa"}
          label="Empresa activa"
          value={activeCompany ? "Lista" : "Pendiente"}
        />
        <MetricCard
          detail={organization?.name ?? "Organizacion"}
          label="Facturas registradas"
          value={String(invoices.length)}
        />
        <MetricCard
          detail="Borrador o revision"
          label="Pendientes"
          value={String(pendingCount)}
        />
        <MetricCard
          detail={activeCompany?.base_currency ?? organization?.base_currency ?? "CRC"}
          label="Total registrado"
          value={formatMoney(
            totalAmount,
            activeCompany?.base_currency ?? organization?.base_currency ?? "CRC",
          )}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <PremiumCard className="overflow-hidden">
          <div className="border-b border-white/[0.07] px-5 py-4">
            <p className="text-sm font-medium text-white">Facturas recientes</p>
            <p className="mt-1 text-xs text-slate-500">
              {activeCompany
                ? `Datos reales de ${activeCompany.name}.`
                : "Selecciona una empresa activa para listar facturas."}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.16em] text-slate-600">
                <tr>
                  <th className="px-5 py-3 font-medium">Proveedor</th>
                  <th className="px-5 py-3 font-medium">Documento</th>
                  <th className="px-5 py-3 font-medium">Fecha</th>
                  <th className="px-5 py-3 font-medium">Subtotal</th>
                  <th className="px-5 py-3 font-medium">Impuesto</th>
                  <th className="px-5 py-3 font-medium">Total</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 font-medium">Documento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {invoices.length > 0 ? (
                  invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="px-5 py-4 font-medium text-white">
                        {invoice.proveedor}
                      </td>
                      <td className="px-5 py-4 text-slate-400">
                        {invoice.numero_documento ?? "Sin numero"}
                      </td>
                      <td className="px-5 py-4 text-slate-400">
                        {invoice.fecha ?? "Sin fecha"}
                      </td>
                      <td className="px-5 py-4 text-slate-400">
                        {formatMoney(invoice.subtotal, invoice.moneda)}
                      </td>
                      <td className="px-5 py-4 text-slate-400">
                        {formatMoney(invoice.impuesto, invoice.moneda)}
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-100">
                        {formatMoney(invoice.total, invoice.moneda)}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge>
                          {statusLabels[invoice.estado] ?? invoice.estado}
                        </StatusBadge>
                      </td>
                      <td className="px-5 py-4">
                        <form
                          action={uploadDocumentAction}
                          className="flex items-center gap-2"
                        >
                          <input name="redirectTo" type="hidden" value="/facturas" />
                          <input name="relatedType" type="hidden" value="invoice" />
                          <input name="relatedId" type="hidden" value={invoice.id} />
                          <input name="documentType" type="hidden" value="factura" />
                          <input
                            accept="application/pdf,image/*,.xml,application/xml,text/xml"
                            className="w-40 rounded-lg border border-white/[0.08] bg-black/20 px-2 py-1.5 text-xs text-slate-400 file:mr-2 file:rounded-md file:border-0 file:bg-white/[0.08] file:px-2 file:py-1 file:text-xs file:text-slate-200"
                            name="file"
                            required
                            type="file"
                          />
                          <button
                            className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/15"
                            type="submit"
                          >
                            Adjuntar
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      className="px-5 py-10 text-center text-sm text-slate-500"
                      colSpan={8}
                    >
                      No hay facturas registradas para la empresa activa.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </PremiumCard>

        <div id="nueva-factura">
          <PremiumCard className="p-5">
            <p className="text-sm font-medium text-white">Nueva factura manual</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {activeCompany
                ? `Se guardara en ${activeCompany.name}.`
                : "Selecciona una empresa activa antes de registrar."}
            </p>

            <form action={createInvoiceAction} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-300">
                  Tipo
                </span>
                <select
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10"
                  defaultValue="factura"
                  disabled={!activeCompany}
                  name="tipoDocumento"
                >
                  <option className="bg-slate-950" value="factura">
                    Factura
                  </option>
                  <option className="bg-slate-950" value="tiquete">
                    Tiquete
                  </option>
                  <option className="bg-slate-950" value="nota_credito">
                    Nota credito
                  </option>
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-300">
                  Estado
                </span>
                <select
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10"
                  defaultValue="borrador"
                  disabled={!activeCompany}
                  name="estado"
                >
                  <option className="bg-slate-950" value="borrador">
                    Borrador
                  </option>
                  <option className="bg-slate-950" value="revision">
                    Revision
                  </option>
                  <option className="bg-slate-950" value="validada">
                    Validada
                  </option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-slate-300">
                Proveedor
              </span>
              <input
                className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                disabled={!activeCompany}
                name="proveedor"
                placeholder="Proveedor S.A."
                required
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-300">
                  Numero
                </span>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                  disabled={!activeCompany}
                  name="numeroDocumento"
                  placeholder="00100001010000000001"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-300">
                  Fecha
                </span>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                  disabled={!activeCompany}
                  name="fecha"
                  type="date"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-300">
                  Moneda
                </span>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                  disabled={!activeCompany}
                  name="moneda"
                  placeholder={activeCompany?.base_currency ?? "CRC"}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-300">
                  Subtotal
                </span>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                  disabled={!activeCompany}
                  min="0"
                  name="subtotal"
                  placeholder="0.00"
                  step="0.01"
                  type="number"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-300">
                  Impuesto
                </span>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                  disabled={!activeCompany}
                  min="0"
                  name="impuesto"
                  placeholder="0.00"
                  step="0.01"
                  type="number"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-300">
                  Total
                </span>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                  disabled={!activeCompany}
                  min="0"
                  name="total"
                  placeholder="0.00"
                  step="0.01"
                  type="number"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-slate-300">Notas</span>
              <textarea
                className="mt-2 min-h-24 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                disabled={!activeCompany}
                name="notas"
                placeholder="Observaciones internas"
              />
            </label>

            <button
              className="flex h-12 w-full items-center justify-center rounded-xl bg-cyan-100 px-4 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!activeCompany}
              type="submit"
            >
              Guardar factura
            </button>
            </form>
          </PremiumCard>
        </div>
      </section>
    </ModuleFrame>
  );
}
