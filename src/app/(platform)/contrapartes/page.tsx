import Link from "next/link";
import { createCounterpartyAction } from "@/app/(platform)/contrapartes/actions";
import {
  MetricCard,
  ModuleFrame,
  ModuleHeader,
  StatusBadge,
} from "@/components/modules/shared";
import { PremiumCard } from "@/components/ui/premium-card";
import {
  listCounterparties,
  type CounterpartyFilters,
  type CounterpartyRecord,
} from "@/lib/counterparties";

type CounterpartiesPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    type?: string;
  }>;
};

const typeLabels: Record<string, string> = {
  both: "Proveedor y cliente",
  customer: "Cliente",
  supplier: "Proveedor",
};

function parseFilters(
  params: Awaited<NonNullable<CounterpartiesPageProps["searchParams"]>>,
): CounterpartyFilters {
  const type =
    params?.type === "supplier" ||
    params?.type === "customer" ||
    params?.type === "both"
      ? params.type
      : "all";
  const status =
    params?.status === "inactive" || params?.status === "all"
      ? params.status
      : "active";

  return {
    query: params?.q ?? "",
    status,
    type,
  };
}

function getLastActivity(counterparty: CounterpartyRecord) {
  return counterparty.updated_at ?? counterparty.created_at;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Sin actividad";
  }

  return new Intl.DateTimeFormat("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function CounterpartyForm() {
  return (
    <div id="nueva-contraparte">
    <PremiumCard className="p-5">
      <p className="text-sm font-semibold text-white">Nueva contraparte</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Alimenta el motor documental con proveedores y clientes conocidos.
      </p>

      <form action={createCounterpartyAction} className="mt-5 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-300">Nombre</span>
          <input
            className="mt-2 h-11 w-full rounded-xl border border-white/[0.1] bg-white/[0.06] px-3.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/10"
            name="name"
            placeholder="Proveedor S.A."
            required
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-300">Tipo</span>
            <select
              className="mt-2 h-11 w-full rounded-xl border border-white/[0.1] bg-white/[0.06] px-3.5 text-sm text-white outline-none focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/10"
              defaultValue="supplier"
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
              defaultValue="true"
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
            name="taxId"
            placeholder="3-101-000000"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-300">Email</span>
            <input
              className="mt-2 h-11 w-full rounded-xl border border-white/[0.1] bg-white/[0.06] px-3.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/10"
              name="email"
              placeholder="contacto@empresa.com"
              type="email"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-300">Telefono</span>
            <input
              className="mt-2 h-11 w-full rounded-xl border border-white/[0.1] bg-white/[0.06] px-3.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/10"
              name="phone"
              placeholder="+506 0000-0000"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-slate-300">Notas</span>
          <textarea
            className="mt-2 min-h-24 w-full rounded-xl border border-white/[0.1] bg-white/[0.06] px-3.5 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/10"
            name="notes"
            placeholder="Condiciones, contacto principal, observaciones."
          />
        </label>

        <button className="om7-btn-primary h-12 w-full px-4" type="submit">
          Crear contraparte
        </button>
      </form>
    </PremiumCard>
    </div>
  );
}

export default async function CounterpartiesPage({
  searchParams,
}: CounterpartiesPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const filters = parseFilters(resolvedSearchParams);
  const { activeOrganization, counterparties } = await listCounterparties(filters);
  const activeCount = counterparties.filter((item) => item.is_active).length;
  const supplierCount = counterparties.filter((item) =>
    ["supplier", "both"].includes(item.type),
  ).length;
  const customerCount = counterparties.filter((item) =>
    ["customer", "both"].includes(item.type),
  ).length;

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Contrapartes"
        description="Administra proveedores y clientes para que OM7 detecte, clasifique y conecte documentos con registros operativos."
        action={
          <a className="om7-btn-primary px-4 py-2.5" href="#nueva-contraparte">
            Crear contraparte
          </a>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail={activeOrganization?.name ?? "Organizacion"}
          label="Contrapartes"
          value={String(counterparties.length)}
        />
        <MetricCard
          detail="Disponibles para deteccion documental"
          label="Activas"
          value={String(activeCount)}
        />
        <MetricCard
          detail="Compras y gastos"
          label="Proveedores"
          value={String(supplierCount)}
        />
        <MetricCard
          detail="Ventas e ingresos"
          label="Clientes"
          value={String(customerCount)}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <PremiumCard className="overflow-hidden">
          <div className="border-b border-white/[0.07] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">
                  Directorio de contrapartes
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Busqueda rapida por nombre, cedula, email o telefono.
                </p>
              </div>
              <form className="grid gap-2 sm:grid-cols-[1fr_auto_auto]" method="get">
                <input
                  className="h-11 min-w-0 rounded-xl border border-white/[0.1] bg-white/[0.06] px-3.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/10"
                  defaultValue={filters.query}
                  name="q"
                  placeholder="Buscar contraparte..."
                />
                <select
                  className="h-11 rounded-xl border border-white/[0.1] bg-white/[0.06] px-3 text-sm text-white outline-none focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/10"
                  defaultValue={filters.type}
                  name="type"
                >
                  <option className="bg-slate-950" value="all">
                    Todos
                  </option>
                  <option className="bg-slate-950" value="supplier">
                    Proveedores
                  </option>
                  <option className="bg-slate-950" value="customer">
                    Clientes
                  </option>
                  <option className="bg-slate-950" value="both">
                    Ambos
                  </option>
                </select>
                <select
                  className="h-11 rounded-xl border border-white/[0.1] bg-white/[0.06] px-3 text-sm text-white outline-none focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/10"
                  defaultValue={filters.status}
                  name="status"
                >
                  <option className="bg-slate-950" value="active">
                    Activos
                  </option>
                  <option className="bg-slate-950" value="inactive">
                    Inactivos
                  </option>
                  <option className="bg-slate-950" value="all">
                    Todos
                  </option>
                </select>
                <button className="om7-btn-secondary h-11 px-4 sm:col-span-3" type="submit">
                  Aplicar filtros
                </button>
              </form>
            </div>
          </div>

          <div className="max-h-[72vh] overflow-y-auto overscroll-contain">
            <div className="divide-y divide-white/[0.06]">
            {counterparties.length > 0 ? (
              counterparties.map((counterparty) => (
                <article
                  className="grid gap-4 p-5 transition hover:bg-white/[0.025] xl:grid-cols-[minmax(0,1.2fr)_0.8fr_auto]"
                  key={counterparty.id}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 truncate text-base font-semibold text-white">
                        {counterparty.name}
                      </p>
                      <StatusBadge>
                        {counterparty.is_active ? "Activo" : "Inactivo"}
                      </StatusBadge>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">
                      {typeLabels[counterparty.type] ?? counterparty.type}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Ultima actividad: {formatDate(getLastActivity(counterparty))}
                    </p>
                  </div>
                  <div className="grid min-w-0 gap-2 text-sm text-slate-400 sm:grid-cols-3 xl:grid-cols-1">
                    <span className="truncate">
                      Cedula: {counterparty.tax_id ?? "Sin registrar"}
                    </span>
                    <span className="truncate">
                      Email: {counterparty.email ?? "Sin registrar"}
                    </span>
                    <span className="truncate">
                      Tel: {counterparty.phone ?? "Sin registrar"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 xl:justify-end">
                    <Link
                      className="om7-btn-secondary px-4 py-2.5"
                      href={`/contrapartes/${counterparty.id}`}
                    >
                      Ver / Editar
                    </Link>
                  </div>
                </article>
              ))
            ) : (
              <div className="p-10 text-center text-sm text-slate-500">
                No hay contrapartes con los filtros actuales.
              </div>
            )}
            </div>
          </div>
        </PremiumCard>

        <CounterpartyForm />
      </section>
    </ModuleFrame>
  );
}
