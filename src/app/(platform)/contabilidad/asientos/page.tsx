import Link from "next/link";
import {
  BackLink,
  MetricCard,
  ModuleFrame,
  ModuleHeader,
} from "@/components/modules/shared";
import { StatusBadge } from "@/components/om7/operational-design-system";
import { PremiumCard } from "@/components/ui/premium-card";
import { getAsientosContables } from "@/lib/asientos-contables";

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

export default async function AsientosContablesPage() {
  const result = await getAsientosContables().catch((error: unknown) => ({
    asientos: [],
    error:
      error instanceof Error && error.message
        ? error.message
        : "No se pudieron cargar los asientos.",
    organization: null,
  }));
  const { asientos, organization } = result;
  const actionError = "error" in result ? result.error : null;
  const borradores = asientos.filter((asiento) => asiento.estado === "borrador");
  const contabilizados = asientos.filter(
    (asiento) => asiento.estado === "contabilizado",
  );
  const anulados = asientos.filter((asiento) => asiento.estado === "anulado");
  const totalDebito = asientos.reduce(
    (sum, asiento) => sum + Number(asiento.total_debito ?? 0),
    0,
  );

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Asientos contables"
        description="Motor transaccional base de OM7: borradores, contabilizacion, anulacion y lineas conectadas al catalogo contable real."
        action={
          <div className="flex flex-wrap gap-2">
            <BackLink href="/contabilidad" label="Volver a contabilidad" />
            <Link
              className="om7-btn-primary px-4 py-2.5"
              href="/contabilidad/asientos/manual"
            >
              Asiento manual
            </Link>
            <Link className="om7-btn-ghost px-4 py-2.5" href="/contabilidad/mayor">
              Mayor
            </Link>
            <Link
              className="om7-btn-ghost px-4 py-2.5"
              href="/contabilidad/balance-comprobacion"
            >
              Balance comprobacion
            </Link>
            <Link className="om7-btn-ghost px-4 py-2.5" href="/contabilidad/catalogo">
              Ver catalogo
            </Link>
          </div>
        }
      />

      {actionError ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/[0.08] p-5">
          <p className="text-sm font-semibold text-amber-100">
            Asientos no disponibles
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-100/75">
            {actionError}
          </p>
          <p className="mt-3 text-sm leading-6 text-amber-100/70">
            Ejecuta primero la migracion{" "}
            <span className="font-mono">supabase/schema-027-asientos-contables.sql</span>.
          </p>
        </PremiumCard>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail={organization?.name ?? "Organizacion activa"}
          label="Asientos"
          value={String(asientos.length)}
        />
        <MetricCard
          detail="Editables antes de contabilizar"
          label="Borradores"
          value={String(borradores.length)}
        />
        <MetricCard
          detail="Bloqueados contablemente"
          label="Contabilizados"
          value={String(contabilizados.length)}
        />
        <MetricCard
          detail="No se eliminan"
          label="Anulados"
          value={String(anulados.length)}
        />
      </section>

      <PremiumCard className="overflow-hidden">
        <div className="border-b border-white/[0.07] p-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-base font-semibold text-white">
                Libro operativo de asientos
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Vista inicial del nucleo contable transaccional. La creacion
                automatica desde compras y facturas se conectara en una fase posterior.
              </p>
            </div>
            <StatusBadge tone="cyan">
              Debito total {formatCurrency(totalDebito)}
            </StatusBadge>
          </div>
        </div>

        <div className="om7-responsive-table">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Numero</th>
                <th>Descripcion</th>
                <th>Estado</th>
                <th>Debito</th>
                <th>Credito</th>
                <th>Origen</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {asientos.length > 0 ? (
                asientos.map((asiento) => (
                  <tr key={asiento.id}>
                    <td>{asiento.fecha}</td>
                    <td className="font-mono">#{asiento.numero_asiento}</td>
                    <td>
                      <div className="max-w-xs">
                        <p className="font-semibold text-white">{asiento.descripcion}</p>
                        {asiento.referencia ? (
                          <p className="mt-1 text-xs text-slate-500">
                            {asiento.referencia}
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <StatusBadge tone={getEstadoTone(asiento.estado)}>
                        {getEstadoLabel(asiento.estado)}
                      </StatusBadge>
                    </td>
                    <td>{formatCurrency(asiento.total_debito, asiento.moneda)}</td>
                    <td>{formatCurrency(asiento.total_credito, asiento.moneda)}</td>
                    <td>{asiento.modulo_origen ?? "manual"}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          className="om7-btn-ghost px-3 py-2 text-xs"
                          href={`/contabilidad/asientos/${asiento.id}`}
                        >
                          Ver detalle
                        </Link>
                        {asiento.estado === "borrador" &&
                        (asiento.modulo_origen ?? "manual") === "manual" ? (
                          <Link
                            className="om7-btn-ghost px-3 py-2 text-xs"
                            href={`/contabilidad/asientos/manual/${asiento.id}`}
                          >
                            Editar
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>
                    <div className="p-8 text-center">
                      <p className="text-base font-semibold text-white">
                        Aun no hay asientos reales.
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        El motor ya esta preparado para borradores, lineas,
                        contabilizacion y anulacion. Los modulos operativos se
                        conectaran en fases posteriores.
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
