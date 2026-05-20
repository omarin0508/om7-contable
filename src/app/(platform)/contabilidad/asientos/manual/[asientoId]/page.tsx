import Link from "next/link";
import {
  BackLink,
  MetricCard,
  ModuleFrame,
  ModuleHeader,
} from "@/components/modules/shared";
import { SectionHeader, StatusBadge } from "@/components/om7/operational-design-system";
import { PremiumCard } from "@/components/ui/premium-card";
import { getAsientoContableById } from "@/lib/asientos-contables";
import { listCuentasContables, type CuentaContable } from "@/lib/cuentas-contables";
import {
  deleteManualAsientoAction,
  postManualAsientoAction,
  saveManualAsientoAction,
  voidManualAsientoAction,
} from "../../actions";

type ManualAsientoEditPageProps = {
  params: Promise<{
    asientoId: string;
  }>;
  searchParams: Promise<{
    error?: string;
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

function getAccountLabel(account: CuentaContable) {
  return `${account.codigo} - ${account.nombre}`;
}

function metadataNote(metadata: Record<string, unknown>) {
  const note = metadata.nota;
  return typeof note === "string" ? note : "";
}

function ManualAsientoEditForm({
  accounts,
  asiento,
}: {
  accounts: CuentaContable[];
  asiento: NonNullable<
    Awaited<ReturnType<typeof getAsientoContableById>>["asiento"]
  >;
}) {
  const isDraft = asiento.estado === "borrador";
  const lineas = asiento.lineas ?? [];
  const rows = [
    ...lineas,
    ...Array.from({ length: Math.max(4, 10 - lineas.length) }, () => null),
  ];

  return (
    <form action={saveManualAsientoAction} className="grid gap-5">
      <input name="asientoId" type="hidden" value={asiento.id} />
      <input
        name="redirectTo"
        type="hidden"
        value={`/contabilidad/asientos/manual/${asiento.id}`}
      />

      <PremiumCard className="p-5">
        <SectionHeader
          action={<StatusBadge tone={getEstadoTone(asiento.estado)}>{asiento.estado}</StatusBadge>}
          description="Solo los borradores permiten cambios. Los contabilizados y anulados quedan como evidencia."
          title="Encabezado"
        />
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Fecha
            </span>
            <input
              className="om7-input"
              defaultValue={asiento.fecha}
              disabled={!isDraft}
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
              defaultValue={asiento.periodo ?? ""}
              disabled={!isDraft}
              name="periodo"
              placeholder="2026-05"
              type="month"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Moneda
            </span>
            <select
              className="om7-input"
              defaultValue={asiento.moneda}
              disabled={!isDraft}
              name="moneda"
            >
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
              defaultValue={asiento.tipo_cambio ? String(asiento.tipo_cambio) : ""}
              disabled={!isDraft}
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
              defaultValue={asiento.descripcion}
              disabled={!isDraft}
              name="descripcion"
              required
            />
          </label>
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Referencia
            </span>
            <input
              className="om7-input"
              defaultValue={asiento.referencia ?? ""}
              disabled={!isDraft}
              name="referencia"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Nota
            </span>
            <input
              className="om7-input"
              defaultValue={metadataNote(asiento.metadata)}
              disabled={!isDraft}
              name="nota"
            />
          </label>
        </div>
      </PremiumCard>

      <PremiumCard className="overflow-hidden">
        <div className="border-b border-white/[0.07] p-5">
          <SectionHeader
          description="Edita cuenta, detalle y monto. Para guardar, cada linea debe tener solo debe o solo haber."
            action={<StatusBadge tone="emerald">Debe = Haber</StatusBadge>}
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
                      disabled={!isDraft}
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
                      disabled={!isDraft}
                      name="lineDescription"
                      placeholder="Detalle de la linea"
                    />
                  </td>
                  <td>
                    <input
                      className="om7-input min-w-36"
                      defaultValue={linea?.debito ? String(linea.debito) : ""}
                      disabled={!isDraft}
                      inputMode="decimal"
                      name="lineDebit"
                      placeholder="0.00"
                    />
                  </td>
                  <td>
                    <input
                      className="om7-input min-w-36"
                      defaultValue={linea?.credito ? String(linea.credito) : ""}
                      disabled={!isDraft}
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

      {isDraft ? (
        <div className="flex flex-wrap justify-end gap-2">
          <Link className="om7-btn-ghost px-4 py-2.5" href="/contabilidad/asientos/manual">
            Nuevo
          </Link>
          <button className="om7-btn-primary px-4 py-2.5" type="submit">
            Guardar cambios
          </button>
        </div>
      ) : null}
    </form>
  );
}

export default async function ManualAsientoEditPage({
  params,
  searchParams,
}: ManualAsientoEditPageProps) {
  const { asientoId } = await params;
  const { error } = await searchParams;
  const result = await getAsientoContableById(asientoId).catch((loadError: unknown) => ({
    asiento: null,
    error:
      loadError instanceof Error && loadError.message
        ? loadError.message
        : "No se pudo cargar el asiento.",
    organization: null,
  }));
  const catalogResult = await listCuentasContables().catch(() => ({
    accounts: [] as CuentaContable[],
  }));
  const { asiento, organization } = result;
  const actionError = "error" in result ? result.error : null;
  const accounts = catalogResult.accounts.filter(
    (account) =>
      account.activa &&
      account.tipo_cuenta === "detalle" &&
      account.permite_movimientos,
  );

  if (!asiento) {
    return (
      <ModuleFrame>
        <ModuleHeader
          title="Asiento manual"
          description="No se pudo abrir el borrador manual solicitado."
          action={<BackLink href="/contabilidad/asientos/manual" label="Volver" />}
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

  const isDraft = asiento.estado === "borrador";

  return (
    <ModuleFrame>
      <ModuleHeader
        title={`Asiento manual #${asiento.numero_asiento}`}
        description={asiento.descripcion}
        action={
          <div className="flex flex-wrap gap-2">
            <BackLink href="/contabilidad/asientos/manual" label="Workspace manual" />
            <Link
              className="om7-btn-primary px-4 py-2.5"
              href={`/contabilidad/asientos/manual?templateId=${asiento.id}`}
            >
              Usar como plantilla
            </Link>
            <Link className="om7-btn-ghost px-4 py-2.5" href={`/contabilidad/asientos/${asiento.id}`}>
              Ver detalle oficial
            </Link>
          </div>
        }
      />

      {error ? (
        <PremiumCard className="border-rose-300/15 bg-rose-300/[0.08] p-5">
          <p className="text-sm font-semibold text-rose-100">Accion no completada</p>
          <p className="mt-2 text-sm leading-6 text-rose-100/75">{error}</p>
        </PremiumCard>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail={organization?.name ?? "Organizacion activa"}
          label="Estado"
          value={String(asiento.estado)}
        />
        <MetricCard
          detail={asiento.moneda}
          label="Debe"
          value={formatCurrency(asiento.total_debito, asiento.moneda)}
        />
        <MetricCard
          detail={asiento.moneda}
          label="Haber"
          value={formatCurrency(asiento.total_credito, asiento.moneda)}
        />
        <MetricCard
          detail={asiento.periodo ?? "Sin periodo"}
          label="Fecha"
          value={asiento.fecha}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <ManualAsientoEditForm accounts={accounts} asiento={asiento} />

        <div className="grid h-fit gap-4">
          <PremiumCard className="p-5">
            <SectionHeader
              action={<StatusBadge tone={getEstadoTone(asiento.estado)}>{asiento.estado}</StatusBadge>}
              description="Acciones disponibles segun el estado contable."
              title="Control"
            />
            {isDraft ? (
              <div className="mt-5 grid gap-3">
                <form action={postManualAsientoAction}>
                  <input name="asientoId" type="hidden" value={asiento.id} />
                  <button className="om7-btn-primary w-full px-4 py-2.5" type="submit">
                    Contabilizar
                  </button>
                </form>
                <form action={deleteManualAsientoAction}>
                  <input name="asientoId" type="hidden" value={asiento.id} />
                  <button className="om7-btn-ghost w-full px-4 py-2.5" type="submit">
                    Eliminar borrador
                  </button>
                </form>
              </div>
            ) : (
              <form action={voidManualAsientoAction} className="mt-5 grid gap-3">
                <input name="asientoId" type="hidden" value={asiento.id} />
                <textarea
                  className="om7-input min-h-24"
                  name="motivoAnulacion"
                  placeholder="Motivo de anulacion"
                />
                <button
                  className="om7-btn-ghost px-4 py-2.5"
                  disabled={asiento.estado === "anulado"}
                  type="submit"
                >
                  Anular asiento
                </button>
              </form>
            )}
          </PremiumCard>
        </div>
      </section>
    </ModuleFrame>
  );
}
