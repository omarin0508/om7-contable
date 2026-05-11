import Link from "next/link";
import { notFound } from "next/navigation";
import {
  activateCounterpartyAction,
  inactivateCounterpartyAction,
  updateCounterpartyAction,
} from "@/app/(platform)/contrapartes/actions";
import {
  MetricCard,
  ModuleFrame,
  ModuleHeader,
  StatusBadge,
} from "@/components/modules/shared";
import { PremiumCard } from "@/components/ui/premium-card";
import { formatCurrencyAmount } from "@/lib/currency";
import { getCounterpartyWorkspace } from "@/lib/counterparties";

type CounterpartyDetailPageProps = {
  params: Promise<{
    counterpartyId: string;
  }>;
};

const typeLabels: Record<string, string> = {
  both: "Proveedor y cliente",
  customer: "Cliente",
  supplier: "Proveedor",
};

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getDocumentName(match: Record<string, unknown>) {
  const document = match.documents as
    | {
        display_name?: string | null;
        original_filename?: string | null;
      }
    | null
    | undefined;

  return document?.display_name || document?.original_filename || "Documento";
}

function CounterpartyEditForm({
  counterparty,
}: {
  counterparty: Awaited<ReturnType<typeof getCounterpartyWorkspace>>["counterparty"];
}) {
  const redirectTo = `/contrapartes/${counterparty.id}`;

  return (
    <PremiumCard className="p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-base font-semibold text-white">
            Informacion general
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Datos usados por OM7 para detectar proveedores y clientes en
            documentos futuros.
          </p>
        </div>
        <StatusBadge>{counterparty.is_active ? "Activo" : "Inactivo"}</StatusBadge>
      </div>

      <form action={updateCounterpartyAction} className="mt-5 space-y-4">
        <input name="counterpartyId" type="hidden" value={counterparty.id} />
        <input name="redirectTo" type="hidden" value={redirectTo} />

        <label className="block">
          <span className="text-sm font-medium text-slate-300">Nombre</span>
          <input
            className="mt-2 h-11 w-full rounded-xl border border-white/[0.1] bg-white/[0.06] px-3.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/10"
            defaultValue={counterparty.name}
            name="name"
            required
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-300">Tipo</span>
            <select
              className="mt-2 h-11 w-full rounded-xl border border-white/[0.1] bg-white/[0.06] px-3.5 text-sm text-white outline-none focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/10"
              defaultValue={counterparty.type}
              name="type"
            >
              <option className="bg-slate-950" value="supplier">
                Proveedor
              </option>
              <option className="bg-slate-950" value="customer">
                Cliente
              </option>
              <option className="bg-slate-950" value="both">
                Ambos
              </option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-300">Estado</span>
            <select
              className="mt-2 h-11 w-full rounded-xl border border-white/[0.1] bg-white/[0.06] px-3.5 text-sm text-white outline-none focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/10"
              defaultValue={counterparty.is_active ? "true" : "false"}
              name="isActive"
            >
              <option className="bg-slate-950" value="true">
                Activo
              </option>
              <option className="bg-slate-950" value="false">
                Inactivo
              </option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-slate-300">
            Cedula / tax ID
          </span>
          <input
            className="mt-2 h-11 w-full rounded-xl border border-white/[0.1] bg-white/[0.06] px-3.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/10"
            defaultValue={counterparty.tax_id ?? ""}
            name="taxId"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-300">Email</span>
            <input
              className="mt-2 h-11 w-full rounded-xl border border-white/[0.1] bg-white/[0.06] px-3.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/10"
              defaultValue={counterparty.email ?? ""}
              name="email"
              type="email"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-300">Telefono</span>
            <input
              className="mt-2 h-11 w-full rounded-xl border border-white/[0.1] bg-white/[0.06] px-3.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/10"
              defaultValue={counterparty.phone ?? ""}
              name="phone"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-slate-300">Notas</span>
          <textarea
            className="mt-2 min-h-24 w-full rounded-xl border border-white/[0.1] bg-white/[0.06] px-3.5 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/10"
            defaultValue={counterparty.notes ?? ""}
            name="notes"
          />
        </label>

        <button className="om7-btn-primary h-12 px-4" type="submit">
          Guardar cambios
        </button>
      </form>

      <div className="mt-5 rounded-2xl border border-white/[0.08] bg-black/15 p-4">
        <p className="text-sm font-semibold text-white">Administracion</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {counterparty.is_active ? (
            <form action={inactivateCounterpartyAction}>
              <input
                name="counterpartyId"
                type="hidden"
                value={counterparty.id}
              />
              <input name="redirectTo" type="hidden" value={redirectTo} />
              <button className="om7-btn-ghost px-4 py-2.5" type="submit">
                Inactivar
              </button>
            </form>
          ) : (
            <form action={activateCounterpartyAction}>
              <input
                name="counterpartyId"
                type="hidden"
                value={counterparty.id}
              />
              <input name="redirectTo" type="hidden" value={redirectTo} />
              <button className="om7-btn-secondary px-4 py-2.5" type="submit">
                Activar
              </button>
            </form>
          )}
        </div>
      </div>
    </PremiumCard>
  );
}

export default async function CounterpartyDetailPage({
  params,
}: CounterpartyDetailPageProps) {
  const { counterpartyId } = await params;
  const workspace = await getCounterpartyWorkspace(counterpartyId).catch(
    () => null,
  );

  if (!workspace) {
    notFound();
  }

  const { counterparty, invoices, matches, purchases, rules } = workspace;
  const totalPurchases = purchases.reduce(
    (sum, purchase) => sum + Number(purchase.total ?? 0),
    0,
  );
  const totalInvoices = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.total ?? 0),
    0,
  );

  return (
    <ModuleFrame>
      <ModuleHeader
        title={counterparty.name}
        description="Ficha operativa de proveedor/cliente con documentos, registros y reglas aprendidas."
        action={
          <Link className="om7-btn-ghost px-4 py-2.5" href="/contrapartes">
            Volver a contrapartes
          </Link>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail={counterparty.tax_id ?? "Sin cedula"}
          label="Tipo"
          value={typeLabels[counterparty.type] ?? counterparty.type}
        />
        <MetricCard
          detail="Documentos detectados"
          label="Documentos"
          value={String(matches.length)}
        />
        <MetricCard
          detail="Compras asociadas"
          label="Compras"
          value={formatCurrencyAmount(totalPurchases, "CRC")}
        />
        <MetricCard
          detail="Facturas asociadas"
          label="Facturas"
          value={formatCurrencyAmount(totalInvoices, "CRC")}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <CounterpartyEditForm counterparty={counterparty} />

        <div className="space-y-5">
          <PremiumCard className="p-5">
            <p className="text-base font-semibold text-white">
              Reglas aprendidas
            </p>
            <div className="mt-4 space-y-3">
              {rules.length > 0 ? (
                rules.map((rule) => (
                  <div
                    className="rounded-2xl border border-white/[0.08] bg-black/15 p-4"
                    key={rule.id}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">
                        {rule.rule_name}
                      </p>
                      <StatusBadge>
                        {rule.is_active ? "Activo" : "Inactivo"}
                      </StatusBadge>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">
                      {rule.suggested_category ?? "Sin categoria"} /{" "}
                      {rule.suggested_account ?? "Sin cuenta"}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Flujo {rule.flow_type} - prioridad {rule.priority}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-white/[0.1] p-4 text-sm text-slate-500">
                  Todavia no hay reglas aprendidas para esta contraparte.
                </p>
              )}
            </div>
          </PremiumCard>

          <PremiumCard className="p-5">
            <p className="text-base font-semibold text-white">
              Documentos asociados
            </p>
            <div className="mt-4 space-y-3">
              {matches.length > 0 ? (
                matches.map((match) => (
                  <Link
                    className="block rounded-2xl border border-white/[0.08] bg-black/15 p-4 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.04]"
                    href={`/documentos/${match.document_id}`}
                    key={match.id}
                  >
                    <p className="text-sm font-semibold text-white">
                      {getDocumentName(match)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {match.match_status} - {formatDate(match.created_at)}
                    </p>
                  </Link>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-white/[0.1] p-4 text-sm text-slate-500">
                  No hay documentos asociados todavia.
                </p>
              )}
            </div>
          </PremiumCard>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <PremiumCard className="p-5">
          <p className="text-base font-semibold text-white">
            Compras asociadas
          </p>
          <div className="mt-4 space-y-3">
            {purchases.length > 0 ? (
              purchases.map((purchase) => (
                <div
                  className="rounded-2xl border border-white/[0.08] bg-black/15 p-4"
                  key={purchase.id}
                >
                  <p className="text-sm font-semibold text-white">
                    {purchase.document_number ?? "Compra sin numero"}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    {formatCurrencyAmount(purchase.total, purchase.currency)}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-2xl border border-dashed border-white/[0.1] p-4 text-sm text-slate-500">
                Sin compras asociadas.
              </p>
            )}
          </div>
        </PremiumCard>

        <PremiumCard className="p-5">
          <p className="text-base font-semibold text-white">
            Facturas asociadas
          </p>
          <div className="mt-4 space-y-3">
            {invoices.length > 0 ? (
              invoices.map((invoice) => (
                <div
                  className="rounded-2xl border border-white/[0.08] bg-black/15 p-4"
                  key={invoice.id}
                >
                  <p className="text-sm font-semibold text-white">
                    {invoice.numero_documento ?? "Factura sin numero"}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    {formatCurrencyAmount(invoice.total, invoice.moneda)}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-2xl border border-dashed border-white/[0.1] p-4 text-sm text-slate-500">
                Sin facturas asociadas.
              </p>
            )}
          </div>
        </PremiumCard>
      </section>
    </ModuleFrame>
  );
}
