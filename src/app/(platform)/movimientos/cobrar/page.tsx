import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BackLink,
  MetricCard,
  ModuleFrame,
  ModuleHeader,
} from "@/components/modules/shared";
import { PremiumCard } from "@/components/ui/premium-card";
import { formatCurrencyAmount, normalizeCurrencyCode } from "@/lib/currency";
import {
  getCollectionStatusKey,
  getCollectionStatusLabel,
  getMovementStatusBadgeClass,
  getRemainingAmount,
} from "@/lib/payments";
import {
  getMovementDashboardData,
  isPastDue,
} from "@/lib/movement-dashboard";

type ReceivablesPageProps = {
  searchParams?: Promise<{
    filter?: string;
  }>;
};

function formatMoney(value: number | null | undefined, currency: string | null) {
  return formatCurrencyAmount(value, currency);
}

export default async function ReceivablesPage({
  searchParams,
}: ReceivablesPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeFilter = resolvedSearchParams.filter ?? "pending";
  const data = await getMovementDashboardData().catch((error) => {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("usuario no autenticado")
    ) {
      redirect("/login");
    }

    throw error;
  });
  const activeCompany = data.activeContext.activeCompany;
  const currency = normalizeCurrencyCode(
    activeCompany?.base_currency ??
      data.activeContext.organization?.base_currency ??
      "CRC",
  );
  const visibleInvoices = data.invoices.filter((invoice) => {
    const collected = data.collectionMap.get(invoice.id)?.amount ?? 0;
    const status = getCollectionStatusKey(invoice.total, collected);

    if (activeFilter === "overdue") {
      return status !== "collected" && isPastDue(invoice.fecha ?? invoice.created_at);
    }

    if (activeFilter === "collected") {
      return status === "collected";
    }

    return status !== "collected";
  });

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Cuentas por cobrar"
        description="Facturas, ingresos y documentos que representan dinero pendiente de recibir."
        action={<BackLink href="/movimientos" label="Volver a movimientos" />}
      />

      <PremiumCard className="border-cyan-200/12 bg-cyan-300/[0.045] p-5">
        <p className="text-sm font-semibold text-cyan-50">Ayuda OM7</p>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
          En este workspace ves lo que terceros le deben a la empresa. El
          siguiente paso normalmente es confirmar el cobro o dar seguimiento al
          vencimiento.
        </p>
      </PremiumCard>

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          detail="Saldo abierto"
          label="Pendiente por cobrar"
          value={formatMoney(data.totalPendingCollections, currency)}
        />
        <MetricCard
          detail="Requieren seguimiento"
          label="Vencidas"
          value={String(data.overdueInvoices.length)}
        />
        <MetricCard
          detail="Movimientos registrados"
          label="Cobradas"
          value={String(
            data.invoices.length - data.pendingInvoices.length,
          )}
        />
      </section>

      <section className="flex flex-wrap gap-2">
        {[
          ["pending", "Pendientes"],
          ["overdue", "Vencidas"],
          ["collected", "Cobradas"],
        ].map(([filter, label]) => (
          <Link
            className={[
              "rounded-full border px-3 py-2 text-xs font-semibold transition",
              activeFilter === filter
                ? "border-cyan-300/30 bg-cyan-300/12 text-cyan-100"
                : "border-white/[0.08] bg-white/[0.04] text-slate-400 hover:text-white",
            ].join(" ")}
            href={`/movimientos/cobrar?filter=${filter}`}
            key={filter}
          >
            {label}
          </Link>
        ))}
      </section>

      <section className="grid gap-4">
        {visibleInvoices.length > 0 ? (
          visibleInvoices.map((invoice) => {
            const summary = data.collectionMap.get(invoice.id);
            const collected = summary?.amount ?? 0;
            const status = getCollectionStatusKey(invoice.total, collected);
            const remaining = getRemainingAmount(invoice.total, collected);
            const overdue = status !== "collected" && isPastDue(invoice.fecha ?? invoice.created_at);

            return (
              <PremiumCard className="p-5" key={invoice.id}>
                <div className="grid max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)] lg:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <span className={getMovementStatusBadgeClass(status)}>
                        {getCollectionStatusLabel(invoice.total, collected)}
                      </span>
                      {overdue ? (
                        <span className="om7-chip om7-chip-amber">Vencida</span>
                      ) : null}
                      {invoice.source_document_id ? (
                        <span className="om7-chip om7-chip-cyan">
                          Desde documento
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-4 text-lg font-semibold text-white">
                      {invoice.counterparty?.name ?? invoice.proveedor ?? "Sin cliente"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Factura {invoice.numero_documento ?? "sin numero"} -{" "}
                      {invoice.fecha ?? "sin fecha"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Vencimiento: {invoice.fecha ?? "No registrado"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-4 text-left lg:text-right">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Saldo
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-white">
                      {formatMoney(remaining, invoice.moneda ?? currency)}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      Cobrado {formatMoney(collected, invoice.moneda ?? currency)}
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link
                    className="om7-btn-primary px-4 py-2.5"
                    href="/facturas?returnTo=%2Fmovimientos%2Fcobrar&returnLabel=Volver%20a%20cuentas%20por%20cobrar"
                  >
                    Registrar cobro
                  </Link>
                  <Link
                    className="om7-btn-secondary px-4 py-2.5"
                    href="/facturas?returnTo=%2Fmovimientos%2Fcobrar&returnLabel=Volver%20a%20cuentas%20por%20cobrar"
                  >
                    Ver factura
                  </Link>
                  {invoice.source_document_id ? (
                    <Link
                      className="om7-btn-ghost px-4 py-2.5"
                      href={`/documentos/${invoice.source_document_id}`}
                    >
                      Ver documento
                    </Link>
                  ) : null}
                </div>
              </PremiumCard>
            );
          })
        ) : (
          <PremiumCard className="border-dashed p-10 text-center">
            <p className="text-base font-semibold text-white">
              No hay cuentas por cobrar en esta vista.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Cambia el filtro o registra facturas para iniciar el seguimiento.
            </p>
          </PremiumCard>
        )}
      </section>
    </ModuleFrame>
  );
}
