import { redirect } from "next/navigation";
import {
  assignClientToCompanyAction,
  cancelClientInvitationAction,
  createCompanyAction,
  removeClientFromCompanyAction,
} from "@/app/(platform)/empresas/actions";
import { setActiveCompanyAction } from "@/app/(platform)/empresas/context-actions";
import {
  MetricCard,
  ModuleFrame,
  ModuleHeader,
  StatusBadge,
} from "@/components/modules/shared";
import { ClientPortalShareActions } from "@/components/modules/client-portal-share-actions";
import { PremiumCard } from "@/components/ui/premium-card";
import { getActiveContext } from "@/lib/active-context";
import { listCompanyClientAccesses } from "@/lib/company-clients";
import { getCompaniesForActiveOrganization } from "@/lib/companies";

const statusLabels: Record<string, string> = {
  active: "Activo",
  review: "Revision",
  inactive: "Inactivo",
};

const clientStatusLabels: Record<string, string> = {
  active: "Activo",
  inactive: "Sin acceso",
  pending: "Pendiente",
  cancelled: "Sin acceso",
};

function countByStatus(
  companies: Awaited<ReturnType<typeof getCompaniesForActiveOrganization>>["companies"],
  status: string,
) {
  return companies.filter((company) => company.status === status).length;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Pendiente";
  }

  return new Intl.DateTimeFormat("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default async function CompaniesPage() {
  const { activeOrganization, companies } =
    await getCompaniesForActiveOrganization();
  const activeContext = await getActiveContext();

  if (!activeOrganization) {
    redirect("/onboarding");
  }

  const activeCompanyId = activeContext.activeCompany?.id ?? null;
  const companyClientsEntries = await Promise.all(
    companies.map(async (company) => [
      company.id,
      await listCompanyClientAccesses(company.id),
    ] as const),
  );
  const companyClients = new Map(companyClientsEntries);

  const metrics = [
    {
      label: "Empresas activas",
      value: String(countByStatus(companies, "active")),
      detail: "Operando dentro de la organizacion",
    },
    {
      label: "Empresas en revision",
      value: String(countByStatus(companies, "review")),
      detail: "Pendientes de completar datos",
    },
    {
      label: "Empresas inactivas",
      value: String(countByStatus(companies, "inactive")),
      detail: "Archivadas o pausadas",
    },
    {
      label: "Total empresas",
      value: String(companies.length),
      detail: activeOrganization.name,
    },
  ];

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Empresas y Clientes"
        description="Administra empresas reales asociadas a tu organizacion activa, con aislamiento por RLS y base multiempresa."
        action={
          <a
            className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-2.5 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/15"
            href="#nueva-empresa"
          >
            Nuevo cliente/empresa
          </a>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <PremiumCard className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
            <div>
              <p className="text-sm font-medium text-white">
                Directorio empresarial
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Empresas reales de {activeOrganization.name}.
              </p>
            </div>
            <span className="hidden rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-slate-400 sm:inline-flex">
              RLS activo
            </span>
          </div>

          {!activeCompanyId && companies.length > 0 ? (
            <div className="border-b border-amber-300/10 bg-amber-300/10 px-5 py-3 text-sm text-amber-100">
              Selecciona una empresa activa para preparar documentos,
              movimientos y reportes bajo un contexto claro.
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.16em] text-slate-600">
                <tr>
                  <th className="px-5 py-3 font-medium">Empresa</th>
                  <th className="px-5 py-3 font-medium">Razon social</th>
                  <th className="px-5 py-3 font-medium">Identificacion</th>
                  <th className="px-5 py-3 font-medium">Pais</th>
                  <th className="px-5 py-3 font-medium">Moneda</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 font-medium">Contexto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {companies.length > 0 ? (
                  companies.map((company) => (
                    <tr key={company.id}>
                      <td className="px-5 py-4 font-medium text-white">
                        {company.name}
                      </td>
                      <td className="px-5 py-4 text-slate-400">
                        {company.legal_name ?? "Sin registrar"}
                      </td>
                      <td className="px-5 py-4 text-slate-400">
                        {company.tax_id ?? "Sin registrar"}
                      </td>
                      <td className="px-5 py-4 text-slate-400">
                        {company.country ?? activeOrganization.country ?? "N/D"}
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-200">
                        {company.base_currency ?? activeOrganization.base_currency ?? "CRC"}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge>
                          {statusLabels[company.status ?? "active"] ?? company.status}
                        </StatusBadge>
                      </td>
                      <td className="px-5 py-4">
                        {company.id === activeCompanyId ? (
                          <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100">
                            Activa
                          </span>
                        ) : (
                          <form action={setActiveCompanyAction}>
                            <input
                              name="companyId"
                              type="hidden"
                              value={company.id}
                            />
                            <button
                              className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                              type="submit"
                            >
                              Usar como activa
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      className="px-5 py-10 text-center text-sm text-slate-500"
                      colSpan={7}
                    >
                      Todavia no hay empresas creadas para esta organizacion.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </PremiumCard>

        <div id="nueva-empresa">
          <div className="flex flex-col gap-5">
          <PremiumCard className="p-5">
            <p className="text-sm font-medium text-white">Nuevo cliente/empresa</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Crea una empresa o cliente dentro de la organizacion activa.
            </p>

            <form action={createCompanyAction} className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-300">
                Nombre comercial
              </span>
              <input
                className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10"
                name="name"
                placeholder="OM7 Advisory"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-300">
                Razon social
              </span>
              <input
                className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10"
                name="legalName"
                placeholder="OM7 Advisory S.A."
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-300">
                Identificacion fiscal
              </span>
              <input
                className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10"
                name="taxId"
                placeholder="3-101-000000"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-300">Pais</span>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10"
                  name="country"
                  placeholder={activeOrganization.country ?? "Costa Rica"}
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-300">
                  Moneda base
                </span>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10"
                  name="baseCurrency"
                  placeholder={activeOrganization.base_currency ?? "CRC"}
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-slate-300">Estado</span>
              <select
                className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10"
                defaultValue="active"
                name="status"
              >
                <option className="bg-slate-950" value="active">
                  Activo
                </option>
                <option className="bg-slate-950" value="review">
                  Revision
                </option>
                <option className="bg-slate-950" value="inactive">
                  Inactivo
                </option>
              </select>
            </label>

            <button
              className="flex h-12 w-full items-center justify-center rounded-xl bg-cyan-100 px-4 text-sm font-semibold text-slate-950 transition hover:bg-white"
              type="submit"
            >
              Guardar empresa
            </button>
            </form>
          </PremiumCard>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        {companies.map((company) => {
          const clients = companyClients.get(company.id) ?? [];

          return (
            <PremiumCard key={company.id} className="p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-white">
                    {company.name}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Usuarios cliente
                  </p>
                </div>
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100">
                  {clients.filter((client) => client.status === "active").length}{" "}
                  activos
                </span>
                {clients.some((client) => client.status === "active") ? (
                  <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-medium text-emerald-100">
                    Portal habilitado
                  </span>
                ) : null}
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-400">
                Los usuarios cliente asignados aqui podran entrar al Portal
                Cliente y subir XML, PDFs o imagenes para esta empresa. Si el
                correo aun no existe, queda como pendiente hasta completar el
                registro.
              </p>
              <ClientPortalShareActions />

              <div className="mt-5 space-y-3">
                {clients.length > 0 ? (
                  clients.map((client) => (
                    <div
                      className="rounded-2xl border border-white/[0.08] bg-black/15 p-4"
                      key={`${client.access_type}-${client.access_id}`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-medium text-white">
                            {client.email ?? "Email no disponible"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Rol {client.role} -{" "}
                            {client.access_type === "invitation"
                              ? "invitado"
                              : "asignado"}{" "}
                            {formatDate(client.invited_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge>
                            {clientStatusLabels[client.status] ?? client.status}
                          </StatusBadge>
                          {client.access_type === "user" &&
                          client.status === "active" &&
                          client.user_id ? (
                            <form action={removeClientFromCompanyAction}>
                              <input
                                name="companyId"
                                type="hidden"
                                value={company.id}
                              />
                              <input
                                name="userId"
                                type="hidden"
                                value={client.user_id}
                              />
                              <button
                                className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs font-medium text-rose-100 transition hover:bg-rose-300/15"
                                type="submit"
                              >
                                Quitar acceso
                              </button>
                            </form>
                          ) : null}
                          {client.access_type === "invitation" &&
                          client.status === "pending" ? (
                            <form action={cancelClientInvitationAction}>
                              <input
                                name="invitationId"
                                type="hidden"
                                value={client.access_id}
                              />
                              <button
                                className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs font-medium text-rose-100 transition hover:bg-rose-300/15"
                                type="submit"
                              >
                                Cancelar
                              </button>
                            </form>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.025] p-4 text-sm text-slate-500">
                    Todavia no hay usuarios cliente asignados a esta empresa.
                  </div>
                )}
              </div>

              <form action={assignClientToCompanyAction} className="mt-5 space-y-3">
                <input name="companyId" type="hidden" value={company.id} />
                <label className="block">
                  <span className="text-sm font-medium text-slate-300">
                    Email del cliente
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10"
                    name="email"
                    placeholder="cliente@empresa.com"
                    required
                    type="email"
                  />
                </label>
                <button
                  className="flex h-11 w-full items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15"
                  type="submit"
                >
                  Invitar o dar acceso
                </button>
              </form>
            </PremiumCard>
          );
        })}
      </section>
    </ModuleFrame>
  );
}
