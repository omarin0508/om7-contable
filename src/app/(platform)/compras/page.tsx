import Link from "next/link";
import { createPurchaseAction } from "@/app/(platform)/compras/actions";
import { uploadDocumentAction } from "@/app/(platform)/documentos/actions";
import {
  MetricCard,
  ModuleFrame,
  ModuleHeader,
  StatusBadge,
} from "@/components/modules/shared";
import { PremiumCard } from "@/components/ui/premium-card";
import { listPurchases } from "@/lib/purchases";

const statusLabels: Record<string, string> = {
  registrada: "Registrada",
  pendiente: "Pendiente",
  pagada: "Pagada",
  revision: "Revision",
};

const categoryOptions = [
  "Operaciones",
  "Servicios profesionales",
  "Tecnologia",
  "Impuestos",
  "Administrativo",
  "Otros",
];

function formatMoney(value: number | null, currency: string | null) {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: currency || "CRC",
  }).format(value ?? 0);
}

export default async function PurchasesPage() {
  const { activeContext, purchases } = await listPurchases();
  const activeCompany = activeContext.activeCompany;
  const organization = activeContext.organization;
  const currency =
    activeCompany?.base_currency ?? organization?.base_currency ?? "CRC";
  const totalPurchases = purchases.reduce(
    (sum, purchase) => sum + Number(purchase.total ?? 0),
    0,
  );
  const totalTax = purchases.reduce(
    (sum, purchase) => sum + Number(purchase.tax ?? 0),
    0,
  );
  const averagePurchase =
    purchases.length > 0 ? totalPurchases / purchases.length : 0;

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Compras y Gastos"
        description="Administre compras y gastos registrados, creados manualmente o generados desde documentos XML procesados."
        action={
          <a
            className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-2.5 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/15"
            href="#nueva-compra"
          >
            Nueva compra
          </a>
        }
      />

      {!activeCompany ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/10 p-5">
          <p className="text-sm font-medium text-amber-100">
            Selecciona una empresa activa
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-100/75">
            Las compras deben registrarse bajo una empresa. Ve a Empresas y
            define el contexto de trabajo antes de crear gastos reales.
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
          label="Total compras"
          value={formatMoney(totalPurchases, currency)}
        />
        <MetricCard
          detail={organization?.name ?? "Organizacion"}
          label="Cantidad de compras"
          value={String(purchases.length)}
        />
        <MetricCard
          detail="Impuesto registrado"
          label="Impuestos"
          value={formatMoney(totalTax, currency)}
        />
        <MetricCard
          detail={currency}
          label="Promedio"
          value={formatMoney(averagePurchase, currency)}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <PremiumCard className="overflow-hidden">
          <div className="border-b border-white/[0.07] px-5 py-4">
            <p className="text-sm font-medium text-white">Compras recientes</p>
            <p className="mt-1 text-xs text-slate-500">
              {activeCompany
                ? `Datos reales de ${activeCompany.name}.`
                : "Selecciona una empresa activa para listar compras."}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.16em] text-slate-600">
                <tr>
                  <th className="px-5 py-3 font-medium">Proveedor</th>
                  <th className="px-5 py-3 font-medium">Documento</th>
                  <th className="px-5 py-3 font-medium">Fecha</th>
                  <th className="px-5 py-3 font-medium">Categoria</th>
                  <th className="px-5 py-3 font-medium">Metodo</th>
                  <th className="px-5 py-3 font-medium">Total</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 font-medium">Documento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {purchases.length > 0 ? (
                  purchases.map((purchase) => (
                    <tr key={purchase.id}>
                      <td className="px-5 py-4 font-medium text-white">
                        {purchase.supplier_name ?? "Sin proveedor"}
                      </td>
                      <td className="px-5 py-4 text-slate-400">
                        {purchase.document_number ?? "Sin numero"}
                      </td>
                      <td className="px-5 py-4 text-slate-400">
                        {purchase.purchase_date ?? "Sin fecha"}
                      </td>
                      <td className="px-5 py-4 text-slate-400">
                        {purchase.category ?? "Sin categoria"}
                      </td>
                      <td className="px-5 py-4 text-slate-400">
                        {purchase.payment_method ?? "No definido"}
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-100">
                        {formatMoney(purchase.total, purchase.currency)}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge>
                          {statusLabels[purchase.status] ?? purchase.status}
                        </StatusBadge>
                      </td>
                      <td className="px-5 py-4">
                        <form
                          action={uploadDocumentAction}
                          className="flex items-center gap-2"
                        >
                          <input name="redirectTo" type="hidden" value="/compras" />
                          <input name="relatedType" type="hidden" value="purchase" />
                          <input name="relatedId" type="hidden" value={purchase.id} />
                          <input name="documentType" type="hidden" value="compra" />
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
                      No hay compras registradas para la empresa activa.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </PremiumCard>

        <div id="nueva-compra">
          <PremiumCard className="p-5">
            <p className="text-sm font-medium text-white">Nueva compra manual</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {activeCompany
                ? `Se guardara en ${activeCompany.name}.`
                : "Selecciona una empresa activa antes de registrar."}
            </p>

            <form action={createPurchaseAction} className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-300">
                  Proveedor
                </span>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                  disabled={!activeCompany}
                  name="supplierName"
                  placeholder="Proveedor S.A."
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-300">
                    Documento
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                    disabled={!activeCompany}
                    name="documentNumber"
                    placeholder="OC-1001"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-300">
                    Fecha
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                    disabled={!activeCompany}
                    name="purchaseDate"
                    type="date"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-300">
                    Categoria
                  </span>
                  <select
                    className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                    disabled={!activeCompany}
                    name="category"
                  >
                    <option className="bg-slate-950" value="">
                      Seleccionar
                    </option>
                    {categoryOptions.map((category) => (
                      <option
                        className="bg-slate-950"
                        key={category}
                        value={category}
                      >
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-300">
                    Estado
                  </span>
                  <select
                    className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                    defaultValue="registrada"
                    disabled={!activeCompany}
                    name="status"
                  >
                    <option className="bg-slate-950" value="registrada">
                      Registrada
                    </option>
                    <option className="bg-slate-950" value="pendiente">
                      Pendiente
                    </option>
                    <option className="bg-slate-950" value="pagada">
                      Pagada
                    </option>
                    <option className="bg-slate-950" value="revision">
                      Revision
                    </option>
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-slate-300">
                  Descripcion
                </span>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                  disabled={!activeCompany}
                  name="description"
                  placeholder="Servicios, equipos, suscripcion..."
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-300">
                    Moneda
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                    disabled={!activeCompany}
                    name="currency"
                    placeholder={currency}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-300">
                    Metodo pago
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                    disabled={!activeCompany}
                    name="paymentMethod"
                    placeholder="Tarjeta, transferencia..."
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
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

                <label className="block">
                  <span className="text-sm font-medium text-slate-300">
                    Impuesto
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                    disabled={!activeCompany}
                    min="0"
                    name="tax"
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
                  name="notes"
                  placeholder="Observaciones internas"
                />
              </label>

              <button
                className="flex h-12 w-full items-center justify-center rounded-xl bg-cyan-100 px-4 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!activeCompany}
                type="submit"
              >
                Guardar compra
              </button>
            </form>
          </PremiumCard>
        </div>
      </section>
    </ModuleFrame>
  );
}
