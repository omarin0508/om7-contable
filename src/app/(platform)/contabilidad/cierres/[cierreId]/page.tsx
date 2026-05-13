import Link from "next/link";
import {
  BackLink,
  MetricCard,
  ModuleFrame,
  ModuleHeader,
} from "@/components/modules/shared";
import { StatusBadge } from "@/components/om7/operational-design-system";
import { PremiumCard } from "@/components/ui/premium-card";
import {
  closeAccountingClosingAction,
  markClosingItemAction,
  reopenAccountingClosingAction,
} from "@/app/(platform)/contabilidad/cierres/actions";
import {
  getCierreContableById,
  getCierreEstadoLabel,
  getItemEstadoLabel,
  getItemSeveridadLabel,
  type CierreContableItem,
} from "@/lib/cierres-contables";
import { formatCurrencyAmount } from "@/lib/currency";

type CierreDetallePageProps = {
  params: Promise<{
    cierreId: string;
  }>;
  searchParams?: Promise<{
    error?: string;
  }>;
};

function getStatusTone(status: string) {
  if (status === "cerrado" || status === "resuelto" || status === "revisado") {
    return "emerald" as const;
  }

  if (status === "ignorado" || status === "reabierto") {
    return "amber" as const;
  }

  if (status === "en_revision") {
    return "cyan" as const;
  }

  return "slate" as const;
}

function getSeverityTone(severidad: string) {
  if (severidad === "error") {
    return "rose" as const;
  }

  if (severidad === "warning") {
    return "amber" as const;
  }

  if (severidad === "ok") {
    return "emerald" as const;
  }

  return "slate" as const;
}

function getNumberFromResumen(
  resumen: Record<string, unknown> | null,
  section: string,
  key: string,
) {
  const source = resumen?.[section];

  if (!source || typeof source !== "object") {
    return 0;
  }

  const value = (source as Record<string, unknown>)[key];

  return Number(value ?? 0);
}

function groupItemsBySeverity(items: CierreContableItem[]) {
  return {
    error: items.filter((item) => item.severidad === "error"),
    info: items.filter((item) => item.severidad === "info"),
    ok: items.filter((item) => item.severidad === "ok"),
    warning: items.filter((item) => item.severidad === "warning"),
  };
}

function ItemActions({
  cierreId,
  item,
}: {
  cierreId: string;
  item: CierreContableItem;
}) {
  return (
    <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:flex-wrap">
      <form action={markClosingItemAction}>
        <input name="cierreId" type="hidden" value={cierreId} />
        <input name="itemId" type="hidden" value={item.id} />
        <input name="estado" type="hidden" value="revisado" />
        <button className="om7-btn-ghost px-3 py-2 text-xs" type="submit">
          Marcar revisado
        </button>
      </form>
      <form action={markClosingItemAction}>
        <input name="cierreId" type="hidden" value={cierreId} />
        <input name="itemId" type="hidden" value={item.id} />
        <input name="estado" type="hidden" value="resuelto" />
        <button className="om7-btn-ghost px-3 py-2 text-xs" type="submit">
          Marcar resuelto
        </button>
      </form>
      <form
        action={markClosingItemAction}
        className="flex min-w-0 flex-col gap-2 sm:flex-row"
      >
        <input name="cierreId" type="hidden" value={cierreId} />
        <input name="itemId" type="hidden" value={item.id} />
        <input name="estado" type="hidden" value="ignorado" />
        <input
          className="om7-input min-w-0 text-xs"
          name="motivo"
          placeholder="Motivo"
        />
        <button className="om7-btn-ghost px-3 py-2 text-xs" type="submit">
          Ignorar
        </button>
      </form>
    </div>
  );
}

export default async function CierreContableDetallePage({
  params,
  searchParams,
}: CierreDetallePageProps) {
  const { cierreId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const actionError = resolvedSearchParams.error ?? null;
  const { cierre, context, items, itemsResumen } =
    await getCierreContableById(cierreId);
  const groupedItems = groupItemsBySeverity(items);
  const utilidadNeta = getNumberFromResumen(
    cierre.resumen,
    "dashboard",
    "utilidad_neta",
  );
  const flujoNeto = getNumberFromResumen(
    cierre.resumen,
    "dashboard",
    "flujo_neto",
  );
  const saldoFinal = getNumberFromResumen(
    cierre.resumen,
    "dashboard",
    "saldo_final_efectivo",
  );
  const diferenciaBalance = getNumberFromResumen(
    cierre.resumen,
    "dashboard",
    "diferencia_balance",
  );
  const isClosed = cierre.estado === "cerrado";

  return (
    <ModuleFrame>
      <ModuleHeader
        title={`Cierre ${cierre.periodo}`}
        description="Checklist mensual generado desde SQL/RPC para revisar antes de cerrar el periodo contable."
        action={
          <div className="flex flex-wrap gap-2">
            <BackLink href="/contabilidad/cierres" label="Volver a cierres" />
            <Link className="om7-btn-ghost px-4 py-2.5" href="/contabilidad/reportes">
              Reportes
            </Link>
          </div>
        }
      />

      {actionError ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/[0.08] p-5">
          <p className="text-sm font-semibold text-amber-100">
            No se pudo completar la accion
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-100/75">
            {actionError}
          </p>
        </PremiumCard>
      ) : null}

      <PremiumCard className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={getStatusTone(cierre.estado)}>
                {getCierreEstadoLabel(cierre.estado)}
              </StatusBadge>
              <StatusBadge tone="cyan">{context.organizationName}</StatusBadge>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              {cierre.fecha_inicio ?? "Sin inicio"} -{" "}
              {cierre.fecha_fin ?? "Sin fin"}
            </p>
            {cierre.motivo_reapertura ? (
              <p className="mt-2 text-sm leading-6 text-amber-100/80">
                Reapertura: {cierre.motivo_reapertura}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            {!isClosed ? (
              <form action={closeAccountingClosingAction}>
                <input name="cierreId" type="hidden" value={cierre.id} />
                <button className="om7-btn-primary px-4 py-2.5" type="submit">
                  Cerrar periodo
                </button>
              </form>
            ) : null}
            {isClosed ? (
              <form
                action={reopenAccountingClosingAction}
                className="flex flex-col gap-2 sm:flex-row"
              >
                <input name="cierreId" type="hidden" value={cierre.id} />
                <input
                  className="om7-input"
                  name="motivo"
                  placeholder="Motivo de reapertura"
                  required
                />
                <button className="om7-btn-ghost px-4 py-2.5" type="submit">
                  Reabrir
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </PremiumCard>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail="Dashboard contable oficial"
          label="Utilidad neta"
          value={formatCurrencyAmount(utilidadNeta, context.moneda)}
        />
        <MetricCard
          detail="Flujo efectivo oficial"
          label="Flujo neto"
          value={formatCurrencyAmount(flujoNeto, context.moneda)}
        />
        <MetricCard
          detail="Caja/Bancos"
          label="Saldo efectivo"
          value={formatCurrencyAmount(saldoFinal, context.moneda)}
        />
        <MetricCard
          detail="Resumen financiero"
          label="Diferencia balance"
          value={formatCurrencyAmount(diferenciaBalance, context.moneda)}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail="Items generados por backend"
          label="Checklist"
          value={String(itemsResumen.total)}
        />
        <MetricCard
          detail="Estado pendiente"
          label="Pendientes"
          value={String(itemsResumen.pendientes)}
        />
        <MetricCard
          detail="Severidad error"
          label="Errores"
          value={String(itemsResumen.errores)}
        />
        <MetricCard
          detail="Severidad warning"
          label="Advertencias"
          value={String(itemsResumen.warnings)}
        />
      </section>

      {(["error", "warning", "info", "ok"] as const).map((severity) => {
        const severityItems = groupedItems[severity];

        if (severityItems.length === 0) {
          return null;
        }

        return (
          <PremiumCard className="overflow-hidden" key={severity}>
            <div className="border-b border-white/[0.07] p-5">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-base font-semibold text-white">
                    {getItemSeveridadLabel(severity)}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Items persistidos en cierre_contable_items.
                  </p>
                </div>
                <StatusBadge tone={getSeverityTone(severity)}>
                  {severityItems.length}
                </StatusBadge>
              </div>
            </div>
            <div className="grid gap-3 p-4 sm:p-5">
              {severityItems.map((item) => (
                <div
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4"
                  key={item.id}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {item.titulo}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-400">
                        {item.descripcion}
                      </p>
                      <p className="mt-3 text-xs font-semibold text-slate-500">
                        Tipo: {item.tipo}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <StatusBadge tone={getSeverityTone(item.severidad)}>
                        {getItemSeveridadLabel(item.severidad)}
                      </StatusBadge>
                      <StatusBadge tone={getStatusTone(item.estado)}>
                        {getItemEstadoLabel(item.estado)}
                      </StatusBadge>
                    </div>
                  </div>
                  {!isClosed ? (
                    <ItemActions cierreId={cierre.id} item={item} />
                  ) : null}
                </div>
              ))}
            </div>
          </PremiumCard>
        );
      })}
    </ModuleFrame>
  );
}
