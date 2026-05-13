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
  generateClosingChecklistAction,
} from "@/app/(platform)/contabilidad/cierres/actions";
import {
  getCierreEstadoLabel,
  getCierresContables,
} from "@/lib/cierres-contables";

type CierresPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

function toDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function getDefaultPeriod() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const period = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  return {
    fechaFin: toDateInput(lastDay),
    fechaInicio: toDateInput(firstDay),
    periodo: period,
  };
}

function getStatusTone(status: string) {
  if (status === "cerrado") {
    return "emerald" as const;
  }

  if (status === "en_revision") {
    return "cyan" as const;
  }

  if (status === "reabierto") {
    return "amber" as const;
  }

  return "slate" as const;
}

export default async function CierresContablesPage({
  searchParams,
}: CierresPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const actionError = resolvedSearchParams.error ?? null;
  const defaults = getDefaultPeriod();
  const { cierres, context } = await getCierresContables();
  const openCount = cierres.filter((cierre) => cierre.estado !== "cerrado").length;
  const closedCount = cierres.filter((cierre) => cierre.estado === "cerrado").length;
  const pendingItems = cierres.reduce(
    (total, cierre) => total + cierre.itemsResumen.pendientes,
    0,
  );
  const errorItems = cierres.reduce(
    (total, cierre) => total + cierre.itemsResumen.errores,
    0,
  );

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Cierres contables"
        description="Checklist mensual generado desde las RPC oficiales: dashboard ejecutivo, alertas, flujo, balance y documentos operativos."
        action={
          <div className="flex flex-wrap gap-2">
            <BackLink href="/contabilidad" label="Volver a contabilidad" />
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail={context.organizationName}
          label="Cierres abiertos"
          value={String(openCount)}
        />
        <MetricCard
          detail="Periodos formalmente cerrados"
          label="Cierres cerrados"
          value={String(closedCount)}
        />
        <MetricCard
          detail="Items de checklist sin revisar"
          label="Pendientes"
          value={String(pendingItems)}
        />
        <MetricCard
          detail="Items severidad error"
          label="Errores"
          value={String(errorItems)}
        />
      </section>

      <PremiumCard className="p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-base font-semibold text-white">
              Generar checklist mensual
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              OM7 crea o actualiza el cierre con datos oficiales del backend.
            </p>
          </div>
          <form
            action={generateClosingChecklistAction}
            className="grid w-full gap-3 sm:grid-cols-4 lg:max-w-3xl"
          >
            <label className="grid gap-1 text-xs font-semibold text-slate-300">
              Periodo
              <input
                className="om7-input"
                defaultValue={defaults.periodo}
                name="periodo"
                required
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-300">
              Inicio
              <input
                className="om7-input"
                defaultValue={defaults.fechaInicio}
                name="fechaInicio"
                required
                type="date"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-300">
              Fin
              <input
                className="om7-input"
                defaultValue={defaults.fechaFin}
                name="fechaFin"
                required
                type="date"
              />
            </label>
            <button className="om7-btn-primary self-end px-4 py-2.5" type="submit">
              Generar
            </button>
          </form>
        </div>
      </PremiumCard>

      <PremiumCard className="overflow-hidden">
        <div className="border-b border-white/[0.07] p-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-base font-semibold text-white">
                Periodos de cierre
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Los conteos provienen del checklist persistido por la RPC.
              </p>
            </div>
            <StatusBadge tone="cyan">{cierres.length} cierres</StatusBadge>
          </div>
        </div>
        <div className="om7-responsive-table">
          <table>
            <thead>
              <tr>
                <th>Periodo</th>
                <th>Rango</th>
                <th>Estado</th>
                <th>Pendientes</th>
                <th>Errores</th>
                <th>Warnings</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {cierres.map((cierre) => (
                <tr key={cierre.id}>
                  <td className="font-semibold text-white">{cierre.periodo}</td>
                  <td>
                    {cierre.fecha_inicio ?? "Sin inicio"} -{" "}
                    {cierre.fecha_fin ?? "Sin fin"}
                  </td>
                  <td>
                    <StatusBadge tone={getStatusTone(cierre.estado)}>
                      {getCierreEstadoLabel(cierre.estado)}
                    </StatusBadge>
                  </td>
                  <td>{cierre.itemsResumen.pendientes}</td>
                  <td>{cierre.itemsResumen.errores}</td>
                  <td>{cierre.itemsResumen.warnings}</td>
                  <td>
                    <Link
                      className="font-semibold text-cyan-100"
                      href={`/contabilidad/cierres/${cierre.id}`}
                    >
                      Ver cierre
                    </Link>
                  </td>
                </tr>
              ))}
              {cierres.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="p-8 text-center text-sm text-slate-400">
                      Aun no hay cierres contables generados para esta
                      organizacion.
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </PremiumCard>
    </ModuleFrame>
  );
}
