import Link from "next/link";
import { notFound } from "next/navigation";
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

function getEstadoLabel(estado: string) {
  if (estado === "contabilizado") {
    return "Contabilizado";
  }

  if (estado === "anulado") {
    return "Anulado";
  }

  return "Borrador";
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

export default async function AsientoDetallePage({
  params,
}: AsientoDetallePageProps) {
  const { asientoId } = await params;
  const result = await getAsientoContableById(asientoId).catch(() => null);

  if (!result) {
    notFound();
  }

  const { asiento } = result;
  const diferencia = Number(asiento.total_debito ?? 0) - Number(asiento.total_credito ?? 0);

  return (
    <ModuleFrame>
      <ModuleHeader
        title={`Asiento #${asiento.numero_asiento}`}
        description={asiento.descripcion}
        action={
          <div className="flex flex-wrap gap-2">
            <BackLink href="/contabilidad/asientos" label="Volver a asientos" />
            <Link className="om7-btn-ghost px-4 py-2.5" href="/contabilidad/catalogo">
              Ver catalogo
            </Link>
          </div>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard detail={asiento.fecha} label="Fecha" value={asiento.periodo ?? "-"} />
        <MetricCard
          detail="Debe"
          label="Total debito"
          value={formatCurrency(asiento.total_debito, asiento.moneda)}
        />
        <MetricCard
          detail="Haber"
          label="Total credito"
          value={formatCurrency(asiento.total_credito, asiento.moneda)}
        />
        <MetricCard
          detail="Debe - Haber"
          label="Diferencia"
          value={formatCurrency(diferencia, asiento.moneda)}
        />
      </section>

      <PremiumCard className="overflow-hidden">
        <div className="border-b border-white/[0.07] p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-base font-semibold text-white">Lineas del asiento</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Cada linea apunta a una cuenta detalle del catalogo contable real.
              </p>
            </div>
            <StatusBadge tone={getEstadoTone(asiento.estado)}>
              {getEstadoLabel(asiento.estado)}
            </StatusBadge>
          </div>
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
              {(asiento.lineas ?? []).length > 0 ? (
                (asiento.lineas ?? []).map((linea) => (
                  <tr key={linea.id}>
                    <td>
                      <div>
                        <p className="font-mono text-cyan-100">
                          {linea.cuenta?.codigo ?? "-"}
                        </p>
                        <p className="mt-1 text-sm text-white">
                          {linea.cuenta?.nombre ?? "Cuenta no disponible"}
                        </p>
                      </div>
                    </td>
                    <td>{linea.descripcion ?? "-"}</td>
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
                        Este asiento aun no tiene lineas.
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        Las lineas se agregaran desde formularios o automatizaciones en
                        fases posteriores.
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
