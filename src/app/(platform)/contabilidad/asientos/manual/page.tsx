import Link from "next/link";
import { ManualAsientoForm } from "@/components/accounting/manual-asiento-form";
import { BackLink, ModuleFrame, ModuleHeader } from "@/components/modules/shared";
import { SectionHeader, StatusBadge } from "@/components/om7/operational-design-system";
import { PremiumCard } from "@/components/ui/premium-card";
import { getAsientosContables } from "@/lib/asientos-contables";
import { listCuentasContables, type CuentaContable } from "@/lib/cuentas-contables";

type ManualAsientosPageProps = {
  searchParams: Promise<{
    error?: string;
    templateId?: string;
  }>;
};

function formatCurrency(value: number, currency = "CRC") {
  return new Intl.NumberFormat("es-CR", {
    currency,
    maximumFractionDigits: 2,
    style: "currency",
  }).format(Number(value ?? 0));
}

export default async function ManualAsientosPage({
  searchParams,
}: ManualAsientosPageProps) {
  const { error, templateId } = await searchParams;
  const catalogResult = await listCuentasContables().catch((loadError: unknown) => ({
    accounts: [] as CuentaContable[],
    error:
      loadError instanceof Error && loadError.message
        ? loadError.message
        : "No se pudo cargar el catalogo contable.",
    organization: null,
  }));
  const asientosResult = await getAsientosContables().catch(() => ({
    asientos: [],
    organization: null,
  }));
  const accounts = catalogResult.accounts.filter(
    (account) =>
      account.activa &&
      account.tipo_cuenta === "detalle" &&
      account.permite_movimientos,
  );
  const manualAsientos = asientosResult.asientos.filter(
    (asiento) => (asiento.modulo_origen ?? "manual") === "manual",
  );
  const selectedTemplate =
    templateId && templateId.length > 0
      ? (manualAsientos.find((asiento) => asiento.id === templateId) ?? null)
      : null;
  const catalogError = "error" in catalogResult ? catalogResult.error : null;

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Asientos manuales"
        description="Captura manual de asientos con partida doble y busqueda rapida de cuentas."
        action={
          <div className="flex flex-wrap gap-2">
            <BackLink href="/contabilidad/asientos" label="Volver a asientos" />
            <Link className="om7-btn-ghost px-4 py-2.5" href="/contabilidad/catalogo">
              Catalogo
            </Link>
          </div>
        }
      />

      {error ? (
        <PremiumCard className="border-rose-300/15 bg-rose-300/[0.08] p-5">
          <p className="text-sm font-semibold text-rose-100">No se guardo el asiento</p>
          <p className="mt-2 text-sm leading-6 text-rose-100/75">{error}</p>
        </PremiumCard>
      ) : null}

      {catalogError ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/[0.08] p-5">
          <p className="text-sm font-semibold text-amber-100">
            Catalogo contable no disponible
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-100/75">
            {catalogError}
          </p>
        </PremiumCard>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <ManualAsientoForm accounts={accounts} template={selectedTemplate} />

        <PremiumCard className="h-fit overflow-hidden">
          <div className="border-b border-white/[0.07] p-5">
            <SectionHeader
              description="Escoge uno para precargar sus lineas y guardar otro asiento."
              title="Plantillas"
            />
          </div>
          <div className="divide-y divide-white/[0.07]">
            {manualAsientos.length > 0 ? (
              manualAsientos.slice(0, 10).map((asiento) => (
                <div className="p-4" key={asiento.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        #{asiento.numero_asiento} {asiento.descripcion}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{asiento.fecha}</p>
                    </div>
                    <StatusBadge tone={asiento.estado === "borrador" ? "amber" : "emerald"}>
                      {asiento.estado}
                    </StatusBadge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-slate-300">
                      {formatCurrency(asiento.total_debito, asiento.moneda)}
                    </p>
                    <Link
                      className="om7-btn-ghost px-3 py-2 text-xs"
                      href={`/contabilidad/asientos/manual?templateId=${asiento.id}`}
                    >
                      Usar
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-5 text-sm leading-6 text-slate-500">
                Aun no hay asientos manuales.
              </div>
            )}
          </div>
        </PremiumCard>
      </section>
    </ModuleFrame>
  );
}
