import Link from "next/link";
import {
  BackLink,
  MetricCard,
  ModuleFrame,
  ModuleHeader,
} from "@/components/modules/shared";
import { StatusBadge } from "@/components/om7/operational-design-system";
import { PremiumCard } from "@/components/ui/premium-card";
import { getMayorGeneral } from "@/lib/reportes-contables";

type MayorPageProps = {
  searchParams?: Promise<{
    cuentaId?: string;
    desde?: string;
    hasta?: string;
  }>;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CR", {
    currency: "CRC",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(Number(value ?? 0));
}

export default async function MayorGeneralPage({ searchParams }: MayorPageProps) {
  const params = searchParams ? await searchParams : {};
  const result = await getMayorGeneral({
    cuentaId: params.cuentaId ?? null,
    fechaDesde: params.desde ?? null,
    fechaHasta: params.hasta ?? null,
  }).catch((error: unknown) => ({
    error:
      error instanceof Error && error.message
        ? error.message
        : "No se pudo cargar el mayor general.",
    movimientos: [],
    organizationId: null,
  }));
  const { movimientos } = result;
  const actionError = "error" in result ? result.error : null;

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Mayor general"
        description="Movimientos contables contabilizados, con saldo natural acumulado calculado oficialmente en SQL."
        action={
          <div className="flex flex-wrap gap-2">
            <BackLink href="/contabilidad/asientos" label="Volver a asientos" />
            <Link className="om7-btn-ghost px-4 py-2.5" href="/contabilidad/balance-comprobacion">
              Balance comprobacion
            </Link>
          </div>
        }
      />

      {actionError ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/[0.08] p-5">
          <p className="text-sm font-semibold text-amber-100">
            Mayor general no disponible
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-100/75">
            {actionError}
          </p>
        </PremiumCard>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail="Solo asientos contabilizados"
          label="Movimientos"
          value={String(movimientos.length)}
        />
        <MetricCard
          detail="Filtro aplicado"
          label="Desde"
          value={params.desde ?? "Inicio"}
        />
        <MetricCard
          detail="Filtro aplicado"
          label="Hasta"
          value={params.hasta ?? "Hoy"}
        />
        <MetricCard
          detail="Calculado por cuenta"
          label="Saldo"
          value="Natural"
        />
      </section>

      <PremiumCard className="overflow-hidden">
        <div className="border-b border-white/[0.07] p-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-base font-semibold text-white">
                Movimientos del mayor
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Orden oficial: organizacion, cuenta, fecha y numero de asiento.
              </p>
            </div>
            <StatusBadge tone="cyan">{movimientos.length} lineas</StatusBadge>
          </div>
        </div>

        <div className="om7-responsive-table">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Asiento</th>
                <th>Cuenta</th>
                <th>Descripcion</th>
                <th>Debito</th>
                <th>Credito</th>
                <th>Saldo natural</th>
                <th>Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.length > 0 ? (
                movimientos.map((movimiento) => (
                  <tr key={movimiento.asiento_linea_id}>
                    <td>{movimiento.fecha}</td>
                    <td className="font-mono">#{movimiento.numero_asiento}</td>
                    <td>
                      <p className="font-mono text-cyan-100">{movimiento.codigo}</p>
                      <p className="mt-1 text-sm text-white">{movimiento.nombre}</p>
                    </td>
                    <td>
                      <p className="text-sm text-white">
                        {movimiento.descripcion_linea ??
                          movimiento.descripcion_asiento}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {movimiento.modulo_origen ?? "manual"} ·{" "}
                        {movimiento.referencia ?? "sin referencia"}
                      </p>
                    </td>
                    <td>{formatCurrency(movimiento.debito)}</td>
                    <td>{formatCurrency(movimiento.credito)}</td>
                    <td>{formatCurrency(movimiento.saldo_movimiento_natural)}</td>
                    <td>{formatCurrency(movimiento.saldo_acumulado_natural)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>
                    <div className="p-8 text-center">
                      <p className="text-base font-semibold text-white">
                        No hay movimientos contabilizados.
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        Los borradores y anulados no forman parte del mayor.
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
