import Link from "next/link";
import {
  BackLink,
  MetricCard,
  ModuleFrame,
  ModuleHeader,
} from "@/components/modules/shared";
import {
  ContextualHelpCard,
  SectionHeader,
  StatusBadge,
} from "@/components/om7/operational-design-system";
import { PremiumCard } from "@/components/ui/premium-card";
import { getAsientosContables, type AsientoContable } from "@/lib/asientos-contables";
import { listCuentasContables, type CuentaContable } from "@/lib/cuentas-contables";
import { saveManualAsientoAction } from "../actions";

type ManualAsientosPageProps = {
  searchParams: Promise<{
    error?: string;
    templateId?: string;
  }>;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function currentPeriod() {
  return todayISO().slice(0, 7);
}

function formatCurrency(value: number, currency = "CRC") {
  return new Intl.NumberFormat("es-CR", {
    currency,
    maximumFractionDigits: 2,
    style: "currency",
  }).format(Number(value ?? 0));
}

function getAccountLabel(account: CuentaContable) {
  return `${account.codigo} - ${account.nombre}`;
}

function metadataNote(metadata: Record<string, unknown>) {
  const note = metadata.nota;
  return typeof note === "string" ? note : "";
}

function ManualAsientoForm({
  accounts,
  template,
}: {
  accounts: CuentaContable[];
  template?: AsientoContable | null;
}) {
  const templateLines = template?.lineas ?? [];
  const rows = [
    ...templateLines,
    ...Array.from({ length: Math.max(8, 10 - templateLines.length) }, () => null),
  ];
  const redirectTo = template
    ? `/contabilidad/asientos/manual?templateId=${template.id}`
    : "/contabilidad/asientos/manual";

  return (
    <form action={saveManualAsientoAction} className="grid gap-5">
      <input name="redirectTo" type="hidden" value={redirectTo} />
      {template ? (
        <input name="templateSourceId" type="hidden" value={template.id} />
      ) : null}

      <PremiumCard className="p-5">
        <SectionHeader
          action={
            template ? (
              <StatusBadge tone="cyan">Plantilla #{template.numero_asiento}</StatusBadge>
            ) : null
          }
          description="Registra encabezado, referencia y moneda antes de capturar las lineas del asiento. OM7 valida que debe y haber sean el mismo valor antes de guardar."
          title={template ? "Nuevo asiento desde plantilla" : "Encabezado"}
        />
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Fecha
            </span>
            <input
              className="om7-input"
              defaultValue={todayISO()}
              name="fecha"
              required
              type="date"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Periodo
            </span>
            <input
              className="om7-input"
              defaultValue={template?.periodo ?? currentPeriod()}
              name="periodo"
              placeholder="2026-05"
              type="month"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Moneda
            </span>
            <select className="om7-input" defaultValue={template?.moneda ?? "CRC"} name="moneda">
              <option className="bg-slate-950" value="CRC">
                CRC
              </option>
              <option className="bg-slate-950" value="USD">
                USD
              </option>
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Tipo cambio
            </span>
            <input
              className="om7-input"
              defaultValue={template?.tipo_cambio ? String(template.tipo_cambio) : ""}
              inputMode="decimal"
              name="tipoCambio"
              placeholder="Opcional"
            />
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Nombre del asiento
            </span>
            <input
              className="om7-input"
              defaultValue={template ? `${template.descripcion} - copia` : ""}
              name="descripcion"
              placeholder="Ajuste manual, reclasificacion, provision..."
              required
            />
          </label>
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Referencia
            </span>
            <input
              className="om7-input"
              defaultValue={template?.referencia ?? ""}
              name="referencia"
              placeholder="Documento, cierre, control interno"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Nota
            </span>
            <input
              className="om7-input"
              defaultValue={template ? metadataNote(template.metadata) : ""}
              name="nota"
              placeholder="Contexto adicional"
            />
          </label>
        </div>
      </PremiumCard>

      <PremiumCard className="overflow-hidden">
        <div className="border-b border-white/[0.07] p-5">
          <SectionHeader
            action={
              <div className="flex flex-wrap gap-2">
                <StatusBadge tone="cyan">{accounts.length} cuentas disponibles</StatusBadge>
                <StatusBadge tone="emerald">Debe = Haber</StatusBadge>
              </div>
            }
            description="Usa cuentas detalle que permiten movimientos. Cada linea acepta monto solo en debe o solo en haber; el asiento no se guarda si la partida doble no cuadra."
            title="Lineas contables"
          />
        </div>
        <div className="om7-responsive-table">
          <table>
            <thead>
              <tr>
                <th>Cuenta contable</th>
                <th>Detalle</th>
                <th>Debe</th>
                <th>Haber</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((linea, index) => (
                <tr key={linea?.id ?? `new-${index}`}>
                  <td>
                    <select
                      className="om7-input min-w-72"
                      defaultValue={linea?.cuenta_contable_id ?? ""}
                      name="lineAccountId"
                    >
                      <option className="bg-slate-950" value="">
                        Seleccionar cuenta
                      </option>
                      {accounts.map((account) => (
                        <option className="bg-slate-950" key={account.id} value={account.id}>
                          {getAccountLabel(account)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="om7-input min-w-64"
                      defaultValue={linea?.descripcion ?? ""}
                      name="lineDescription"
                      placeholder="Detalle de la linea"
                    />
                  </td>
                  <td>
                    <input
                      className="om7-input min-w-36"
                      defaultValue={linea?.debito ? String(linea.debito) : ""}
                      inputMode="decimal"
                      name="lineDebit"
                      placeholder="0.00"
                    />
                  </td>
                  <td>
                    <input
                      className="om7-input min-w-36"
                      defaultValue={linea?.credito ? String(linea.credito) : ""}
                      inputMode="decimal"
                      name="lineCredit"
                      placeholder="0.00"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PremiumCard>

      <div className="flex flex-wrap justify-end gap-2">
        <Link className="om7-btn-ghost px-4 py-2.5" href="/contabilidad/asientos">
          Cancelar
        </Link>
        <button className="om7-btn-primary px-4 py-2.5" type="submit">
          Guardar como nuevo borrador
        </button>
      </div>
    </form>
  );
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
  const borradores = manualAsientos.filter((asiento) => asiento.estado === "borrador");
  const selectedTemplate =
    templateId && templateId.length > 0
      ? (manualAsientos.find((asiento) => asiento.id === templateId) ?? null)
      : null;
  const catalogError = "error" in catalogResult ? catalogResult.error : null;

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Asientos manuales"
        description="Workspace para crear, editar, contabilizar y limpiar borradores manuales contra el catalogo contable oficial."
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail={asientosResult.organization?.name ?? "Organizacion activa"}
          label="Manuales"
          value={String(manualAsientos.length)}
        />
        <MetricCard
          detail="Editables"
          label="Borradores"
          value={String(borradores.length)}
        />
        <MetricCard
          detail="Detalle con movimientos"
          label="Cuentas"
          value={String(accounts.length)}
        />
        <MetricCard
          detail="Origen"
          label="Modo"
          value="Manual"
        />
      </section>

      <ContextualHelpCard title="Control contable">
        Los asientos manuales nacen como borrador y siempre deben cumplir partida
        doble: total debe igual a total haber. Tambien puedes tomar un asiento
        existente como plantilla, cambiar los datos necesarios y guardar una copia
        nueva sin tocar el original.
      </ContextualHelpCard>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ManualAsientoForm accounts={accounts} template={selectedTemplate} />

        <div className="grid h-fit gap-4">
          <PremiumCard className="overflow-hidden">
            <div className="border-b border-white/[0.07] p-5">
              <SectionHeader
                description="Escoge un asiento existente para precargar sus lineas y guardarlo como uno nuevo."
                title="Usar plantilla"
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
                        <p className="mt-1 text-xs text-slate-500">
                          {asiento.fecha} · {asiento.periodo ?? "sin periodo"}
                        </p>
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
                        Usar plantilla
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-5 text-sm leading-6 text-slate-500">
                  Aun no hay asientos manuales para usar como plantilla.
                </div>
              )}
            </div>
          </PremiumCard>

          <PremiumCard className="overflow-hidden">
            <div className="border-b border-white/[0.07] p-5">
              <SectionHeader
                description="Acceso rapido a borradores recientes para continuar la edicion."
                title="Borradores manuales"
              />
            </div>
            <div className="divide-y divide-white/[0.07]">
              {borradores.length > 0 ? (
                borradores.slice(0, 8).map((asiento) => (
                  <Link
                    className="block p-4 transition hover:bg-white/[0.04]"
                    href={`/contabilidad/asientos/manual/${asiento.id}`}
                    key={asiento.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          #{asiento.numero_asiento} {asiento.descripcion}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {asiento.fecha} · {asiento.periodo ?? "sin periodo"}
                        </p>
                      </div>
                      <StatusBadge tone="amber">Borrador</StatusBadge>
                    </div>
                    <p className="mt-3 text-sm text-slate-300">
                      {formatCurrency(asiento.total_debito, asiento.moneda)}
                    </p>
                  </Link>
                ))
              ) : (
                <div className="p-5 text-sm leading-6 text-slate-500">
                  No hay borradores manuales pendientes.
                </div>
              )}
            </div>
          </PremiumCard>
        </div>
      </section>
    </ModuleFrame>
  );
}
