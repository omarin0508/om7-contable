import Link from "next/link";
import {
  BackLink,
  MetricCard,
  ModuleFrame,
  ModuleHeader,
} from "@/components/modules/shared";
import { StatusBadge } from "@/components/om7/operational-design-system";
import { PremiumCard } from "@/components/ui/premium-card";
import { getAsientoContableById } from "@/lib/asientos-contables";

type AsientoDetallePageProps = {
  params: Promise<{
    asientoId: string;
  }>;
};

function formatCurrency(value: number, currency = "CRC") {
  return new Intl.NumberFormat("es-CR", {
    currency,
    maximumFractionDigits: 2,
    style: "currency",
  }).format(Number(value ?? 0));
}

function getEstadoTone(estado: string) {
  if (estado === "contabilizado") {
    return "emerald" as const;
  }

  if (estado === "anulado") {
    return "rose" as const;
  }

  return "amber" as const;
}

function getEstadoLabel(estado: string) {
  if (estado === "contabilizado") {
    return "Contabilizado";
  }

  if (estado === "anulado") {
    return "Anulado";
  }

  return "Borrador";
}

export default async function AsientoDetallePage({
  params,
}: AsientoDetallePageProps) {
  const { asientoId } = await params;
  const result = await getAsientoContableById(asientoId).catch((error: unknown) => ({
    asiento: null,
    error:
      error instanceof Error && error.message
        ? error.message
        : "No se pudo cargar el asiento.",
    organization: null,
  }));

  const { asiento, organization } = result;
  const actionError = "error" in result ? result.error : null;

  if (!asiento) {
    return (
      <ModuleFrame>
        <ModuleHeader
          title="Detalle de asiento"
          description="Consulta del asiento contable oficial generado por OM7."
          action={<BackLink href="/contabilidad/asientos" label="Volver a asientos" />}
        />
        <PremiumCard className="border-amber-300/15 bg-amber-300/[0.08] p-5">
          <p className="text-sm font-semibold text-amber-100">
            Asiento no disponible
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-100/75">
            {actionError}
          </p>
        </PremiumCard>
      </ModuleFrame>
    );
  }

  const lineas = asiento.lineas ?? [];

  return (
    <ModuleFrame>
      <ModuleHeader
        title={`Asiento #${asiento.numero_asiento}`}
        description={asiento.descripcion}
        action={
          <div className="flex flex-wrap gap-2">
            <BackLink href="/contabilidad/asientos" label="Volver a asientos" />
            <Link className="om7-btn-ghost px-4 py-2.5" href="/contabilidad/mayor">
              Mayor
            </Link>
            <Link
              className="om7-btn-ghost px-4 py-2.5"
              href="/contabilidad/balance-comprobacion"
            >
              Balance comprobacion
            </Link>
          </div>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail={organization?.name ?? "Organizacion activa"}
          label="Estado"
          value={getEstadoLabel(asiento.estado)}
        />
        <MetricCard
          detail={asiento.moneda}
          label="Debito"
          value={formatCurrency(asiento.total_debito, asiento.moneda)}
        />
        <MetricCard
          detail={asiento.moneda}
          label="Credito"
          value={formatCurrency(asiento.total_credito, asiento.moneda)}
        />
        <MetricCard
          detail={asiento.periodo ?? "Sin periodo"}
          label="Fecha"
          value={asiento.fecha}
        />
      </section>

      <PremiumCard className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/70">
              Asiento oficial
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              {asiento.descripcion}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge tone={getEstadoTone(asiento.estado)}>
                {getEstadoLabel(asiento.estado)}
              </StatusBadge>
              <StatusBadge tone="cyan">
                {asiento.modulo_origen ?? "manual"}
              </StatusBadge>
              {asiento.referencia ? (
                <StatusBadge tone="slate">{asiento.referencia}</StatusBadge>
              ) : null}
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-slate-300">
            <p>
              Total debito:{" "}
              <span className="font-semibold text-white">
                {formatCurrency(asiento.total_debito, asiento.moneda)}
              </span>
            </p>
            <p className="mt-1">
              Total credito:{" "}
              <span className="font-semibold text-white">
                {formatCurrency(asiento.total_credito, asiento.moneda)}
              </span>
            </p>
          </div>
        </div>
      </PremiumCard>

      <PremiumCard className="overflow-hidden">
        <div className="border-b border-white/[0.07] p-5">
          <p className="text-base font-semibold text-white">Lineas contables</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Lineas oficiales persistidas en el motor contable. Los saldos y
            reportes se calculan desde SQL/RPC.
          </p>
        </div>

        <div className="om7-responsive-table">
          <table>
            <thead>
              <tr>
                <th>Cuenta</th>
                <th>Descripcion</th>
                <th>Debito</th>
                <th>Credito</th>
                <th>Moneda</th>
              </tr>
            </thead>
            <tbody>
              {lineas.length > 0 ? (
                lineas.map((linea) => (
                  <tr key={linea.id}>
                    <td>
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-cyan-100">
                          {linea.cuenta?.codigo ?? "Sin cuenta"}
                        </p>
                        <p className="mt-1 font-semibold text-white">
                          {linea.cuenta?.nombre ?? "Cuenta no disponible"}
                        </p>
                      </div>
                    </td>
                    <td>{linea.descripcion ?? "Sin descripcion"}</td>
                    <td>{formatCurrency(linea.debito, linea.moneda)}</td>
                    <td>{formatCurrency(linea.credito, linea.moneda)}</td>
                    <td>{linea.moneda}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>
                    <div className="p-8 text-center">
                      <p className="text-base font-semibold text-white">
                        Este asiento no tiene lineas.
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        Agrega lineas antes de contabilizarlo.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PremiumCard>
    </ModuleFrame>
  );
}
