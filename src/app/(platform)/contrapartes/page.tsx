import Link from "next/link";
import type { ReactNode } from "react";
import { createCounterpartyAction } from "@/app/(platform)/contrapartes/actions";
import {
  ModuleFrame,
  ModuleHeader,
  StatusBadge,
} from "@/components/modules/shared";
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

function CounterpartyLauncher({
  action,
  detail,
  href,
  kicker,
  title,
}: {
  action: string;
  detail: string;
  href: string;
  kicker: string;
  title: string;
}) {
  return (
    <a
      className="group rounded-2xl border border-white/15 bg-[#07111f] p-4 shadow-lg shadow-black/20 transition hover:border-cyan-300/30 hover:bg-cyan-500/[0.04]"
      href={href}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/65">
            {kicker}
          </p>
          <p className="mt-2 text-base font-semibold text-white">{title}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-white/70 transition group-hover:border-cyan-300/30 group-hover:text-cyan-100">
          Filtrar
        </span>
      </div>
      <p className="mt-3 min-h-10 text-sm leading-5 text-slate-400">{detail}</p>
      <div className="mt-4 border-t border-white/10 pt-3 text-sm font-semibold text-cyan-100">
        {action}
      </div>
    </a>
  );
}

function CounterpartySignal({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function CounterpartyForm({
  defaultType,
  title,
}: {
  defaultType: "customer" | "supplier";
  title: string;
}) {
  return (
    <form action={createCounterpartyAction} className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Alta rapida para alimentar compras, facturas y documentos.
        </p>
      </div>

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
              defaultValue={defaultType}
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
  );
}

function CounterpartyModal({
  children,
  id,
  title,
}: {
  children: ReactNode;
  id: string;
  title: string;
}) {
  return (
    <div
      className="invisible fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-3 opacity-0 backdrop-blur-sm transition target:visible target:opacity-100 sm:p-6"
      id={id}
    >
      <div className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-[#07111f] shadow-2xl shadow-cyan-950/30">
        <div className="flex items-center justify-between gap-4 border-b border-white/15 bg-[#06101c] px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/70">
              OM7 Finance OS
            </p>
            <p className="mt-1 truncate text-xl font-semibold text-white">
              {title}
            </p>
          </div>
          <a
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-cyan-300/30 hover:text-cyan-100"
            href="#resumen-relaciones"
          >
            Cerrar
          </a>
        </div>
        <div className="min-h-0 overflow-y-auto p-5 om7-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}

function CounterpartyDirectory({
  counterparties,
}: {
  counterparties: CounterpartyRecord[];
}) {
  return (
    <div className="mt-4 max-h-[52vh] overflow-y-auto rounded-2xl border border-white/15 om7-scrollbar">
      <div className="divide-y divide-white/10">
        {counterparties.length > 0 ? (
          counterparties.map((counterparty) => (
            <article
              className="grid min-w-0 gap-4 p-3 transition hover:bg-cyan-500/[0.03] sm:p-5 xl:grid-cols-[minmax(0,1.2fr)_0.8fr_auto]"
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
  const customerDirectory = counterparties.filter((item) =>
    ["customer", "both"].includes(item.type),
  );
  const supplierDirectory = counterparties.filter((item) =>
    ["supplier", "both"].includes(item.type),
  );
  const hasActiveFilters =
    Boolean(filters.query) || filters.type !== "all" || filters.status !== "active";

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Proveedores / Clientes"
        description="Consola operativa para clasificar relaciones comerciales, conectar documentos y abrir workspaces de gestion."
        action={
          <a
            className="om7-btn-primary px-4 py-2.5"
            href="#modal-nuevo-cliente"
          >
            Nuevo registro
          </a>
        }
      />

      <section className="sticky top-[var(--om7-actions-sticky-top,12.5rem)] z-40 rounded-2xl border border-white/15 bg-[#06101c] p-2 shadow-2xl shadow-black/25 lg:top-[var(--om7-actions-sticky-top-lg,9.25rem)]">
        <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <nav
            aria-label="Navegacion de proveedores y clientes"
            className="flex min-w-0 gap-2 overflow-x-auto om7-scrollbar"
          >
            {[
              ["Clientes", "#modal-clientes"],
              ["Proveedores", "#modal-proveedores"],
              ["Contrapartes", "#modal-directorio"],
            ].map(([label, href]) => (
              <a
                className="min-w-fit shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-medium text-slate-300 transition hover:border-cyan-300/30 hover:bg-cyan-500/10 hover:text-cyan-50"
                href={href}
                key={label}
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex min-w-0 gap-2 overflow-x-auto om7-scrollbar">
            <a
              className="om7-btn-primary min-w-fit shrink-0 px-4 py-2.5"
              href="#modal-nuevo-cliente"
            >
              Nuevo cliente
            </a>
            <a
              className="om7-btn-secondary min-w-fit shrink-0 px-4 py-2.5"
              href="#modal-nuevo-proveedor"
            >
              Nuevo proveedor
            </a>
            <a
              className="om7-btn-secondary min-w-fit shrink-0 px-4 py-2.5"
              href="#modal-directorio"
            >
              Buscar
            </a>
          </div>
        </div>
      </section>

      <section
        className="grid gap-4 lg:grid-cols-2"
        id="resumen-relaciones"
      >
        <CounterpartyLauncher
          action={`${customerCount} clientes detectados`}
          detail="Gestiona clientes, datos fiscales y contactos ligados a facturacion."
          href="#modal-clientes"
          kicker={activeOrganization?.name ?? "Organizacion"}
          title="Clientes"
        />
        <CounterpartyLauncher
          action={`${supplierCount} proveedores detectados`}
          detail="Centraliza proveedores para compras, XML recibidos y gasto operativo."
          href="#modal-proveedores"
          kicker="Compras"
          title="Proveedores"
        />
      </section>

      <CounterpartyModal id="modal-directorio" title="Directorio operativo">
        <div className="mb-4 grid gap-2 sm:grid-cols-3">
          <CounterpartySignal label="Total" value={String(counterparties.length)} />
          <CounterpartySignal label="Activas" value={String(activeCount)} />
          <CounterpartySignal label="Filtros" value={hasActiveFilters ? "Aplicados" : "Listo"} />
        </div>
        <form
          action="/contrapartes#modal-directorio"
          className="grid gap-2 border-b border-white/10 pb-4 sm:grid-cols-[1fr_auto_auto]"
          method="get"
        >
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

        <CounterpartyDirectory counterparties={counterparties} />
      </CounterpartyModal>

      <CounterpartyModal id="modal-clientes" title="Clientes">
        <div className="grid gap-2 sm:grid-cols-2">
          <CounterpartySignal label="Clientes" value={String(customerCount)} />
          <CounterpartySignal label="Activas" value={String(activeCount)} />
        </div>
        <CounterpartyDirectory counterparties={customerDirectory} />
      </CounterpartyModal>

      <CounterpartyModal id="modal-proveedores" title="Proveedores">
        <div className="grid gap-2 sm:grid-cols-2">
          <CounterpartySignal label="Proveedores" value={String(supplierCount)} />
          <CounterpartySignal label="Activas" value={String(activeCount)} />
        </div>
        <CounterpartyDirectory counterparties={supplierDirectory} />
      </CounterpartyModal>

      <CounterpartyModal id="modal-nuevo-cliente" title="Nuevo cliente">
        <CounterpartyForm defaultType="customer" title="Crear cliente" />
      </CounterpartyModal>

      <CounterpartyModal id="modal-nuevo-proveedor" title="Nuevo proveedor">
        <CounterpartyForm defaultType="supplier" title="Crear proveedor" />
      </CounterpartyModal>
    </ModuleFrame>
  );
}
