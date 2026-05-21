import Link from "next/link";
import { createInvoiceAction } from "@/app/(platform)/facturas/actions";
import {
  BackLink,
  ModuleFrame,
  ModuleHeader,
} from "@/components/modules/shared";
import { PremiumCard } from "@/components/ui/premium-card";
import { getActiveContext } from "@/lib/active-context";
import { getInvoiceIssuerCompanyLabel } from "@/lib/invoices";

type NewInvoicePageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function NewInvoicePage({
  searchParams,
}: NewInvoicePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const actionError = resolvedSearchParams.error ?? null;
  const activeContext = await getActiveContext();
  const activeCompany = activeContext.activeCompany;
  const organization = activeContext.organization;
  const currency = activeCompany?.base_currency ?? organization?.base_currency ?? "CRC";
  const issuerCompanyLabel = getInvoiceIssuerCompanyLabel(activeCompany);

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Nueva venta manual"
        description="Un espacio dedicado para registrar ventas cuando no vienen desde XML, PDF o foto."
        action={
          <div className="flex flex-wrap gap-2">
            <BackLink href="/facturas" label="Volver a ventas" />
          </div>
        }
      />

      {actionError ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/[0.08] p-5">
          <p className="text-sm font-semibold text-amber-100">
            No se pudo guardar la venta
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-100/75">
            {actionError}
          </p>
        </PremiumCard>
      ) : null}

      {!activeCompany ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/10 p-5">
          <p className="text-sm font-medium text-amber-100">
            Selecciona una empresa activa
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-100/75">
            Las ventas manuales deben registrarse bajo una empresa cliente.
            Defini una empresa activa antes de continuar.
          </p>
          <Link
            className="mt-4 inline-flex rounded-xl border border-amber-200/20 bg-black/15 px-4 py-2 text-sm font-medium text-amber-100 transition hover:bg-black/25"
            href="/empresas"
          >
            Ir a empresas
          </Link>
        </PremiumCard>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[0.72fr_0.28fr]">
        <PremiumCard className="p-5 sm:p-6">
          <div className="flex flex-col gap-2 border-b border-white/[0.07] pb-5">
            <p className="text-base font-semibold text-white">
              Datos de la venta
            </p>
            <p className="text-sm leading-6 text-slate-400">
              {activeCompany
                ? `Emisor de la venta: ${issuerCompanyLabel}.`
                : "Selecciona una empresa activa antes de registrar."}
            </p>
          </div>

          <form action={createInvoiceAction} className="mt-6 grid gap-5">
            <input name="errorRedirectTo" type="hidden" value="/facturas/nueva" />
            <input name="successRedirectTo" type="hidden" value="/facturas" />

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-300">Tipo</span>
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
                <span className="text-sm font-medium text-slate-300">Estado</span>
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
                Cliente / receptor
              </span>
              <input
                className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                disabled={!activeCompany}
                name="proveedor"
                placeholder="Cliente S.A."
                required
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-300">Numero</span>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                  disabled={!activeCompany}
                  name="numeroDocumento"
                  placeholder="00100001010000000001"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-300">Fecha</span>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                  disabled={!activeCompany}
                  name="fecha"
                  type="date"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-sm font-medium text-slate-300">Moneda</span>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                  disabled={!activeCompany}
                  name="moneda"
                  placeholder={currency}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-300">Subtotal</span>
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
                <span className="text-sm font-medium text-slate-300">Impuesto</span>
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
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
              <label className="block">
                <span className="text-sm font-medium text-slate-300">Total</span>
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
              <label className="block">
                <span className="text-sm font-medium text-slate-300">Notas</span>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                  disabled={!activeCompany}
                  name="notas"
                  placeholder="Observaciones internas"
                />
              </label>
            </div>

            <div className="flex flex-col gap-3 border-t border-white/[0.07] pt-5 sm:flex-row sm:items-center sm:justify-end">
              <Link className="om7-btn-secondary px-4 py-2.5" href="/facturas">
                Cancelar
              </Link>
              <button
                className="om7-btn-primary h-12 px-5 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!activeCompany}
                type="submit"
              >
                Guardar venta
              </button>
            </div>
          </form>
        </PremiumCard>

        <div className="grid gap-4 self-start">
          <PremiumCard className="p-5">
            <p className="text-sm font-semibold text-white">
              Flujo recomendado
            </p>
            <div className="mt-4 grid gap-3 text-sm text-slate-300">
              <p>1. Registras la venta manual.</p>
              <p>2. Volves a ventas y marcas como revisada.</p>
              <p>3. Aprobada la venta, OM7 habilita asiento y cobro.</p>
            </div>
          </PremiumCard>

          <PremiumCard className="p-5">
            <p className="text-sm font-semibold text-white">Tip OM7</p>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Si tenes XML, PDF o foto, es mejor ingresarlo por Bandeja para
              clasificarlo y conservar trazabilidad automatica.
            </p>
            <Link
              className="mt-4 inline-flex rounded-xl border border-cyan-200/20 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15"
              href="/bandeja"
            >
              Ir a bandeja
            </Link>
          </PremiumCard>
        </div>
      </section>
    </ModuleFrame>
  );
}
