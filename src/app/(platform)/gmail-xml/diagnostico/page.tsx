import Link from "next/link";
import { ModuleFrame, ModuleHeader } from "@/components/modules/shared";
import { PremiumCard } from "@/components/ui/premium-card";
import {
  getGmailXmlDiagnostics,
  type GmailXmlDiagnosticsFilters,
} from "@/lib/gmail-xml-diagnostics";

type DiagnosticsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "No disponible";
  }

  return new Intl.DateTimeFormat("es-CR", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "No disponible";
  }

  return new Intl.DateTimeFormat("es-CR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getFilters(
  params: Record<string, string | string[] | undefined>,
): GmailXmlDiagnosticsFilters {
  const source = getParam(params, "source");
  const status = getParam(params, "status");

  return {
    dateFrom: getParam(params, "dateFrom") ?? null,
    dateTo: getParam(params, "dateTo") ?? null,
    source: source === "gmail" || source === "manual" ? source : "all",
    status:
      status === "pendiente" ||
      status === "procesado" ||
      status === "duplicado" ||
      status === "omitido" ||
      status === "error"
        ? status
        : "all",
  };
}

function KpiCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <PremiumCard className="p-4">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-white">
        {value}
      </p>
      {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
    </PremiumCard>
  );
}

export default async function GmailXmlDiagnosticsPage({
  searchParams,
}: DiagnosticsPageProps) {
  const params = (await searchParams) ?? {};
  const filters = getFilters(params);
  const data = await getGmailXmlDiagnostics(filters);
  const activeCompanyName =
    data.activeContext.activeCompany?.legal_name ??
    data.activeContext.activeCompany?.name ??
    "Sin empresa activa";
  const activeOrganizationName =
    data.activeContext.organization?.name ?? "Sin organizacion activa";

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Diagnostico Gmail XML"
        description="Workspace de solo lectura sobre la base de datos OM7. No busca correos en Gmail ni importa documentos."
        action={
          <Link className="om7-btn-ghost px-4 py-2.5" href="/gmail-xml">
            Volver a Gmail XML
          </Link>
        }
      />

      <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <PremiumCard className="p-5">
          <p className="text-sm font-semibold text-white">Contexto activo</p>
          <div className="mt-4 space-y-3 text-sm text-slate-400">
            <div className="flex items-center justify-between gap-3">
              <span>Empresa activa</span>
              <span className="text-right font-medium text-slate-100">
                {activeCompanyName}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Organizacion</span>
              <span className="text-right font-medium text-slate-100">
                {activeOrganizationName}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Gmail XML</span>
              <span
                className={
                  data.gmailXmlEnabled
                    ? "om7-chip om7-chip-emerald"
                    : "om7-chip"
                }
              >
                {data.gmailXmlEnabled ? "Habilitado" : "Inactivo"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Cuenta Gmail</span>
              <span className="text-right font-medium text-slate-100">
                {data.connection?.gmail_email ?? "Sin conectar"}
              </span>
            </div>
          </div>
        </PremiumCard>

        <PremiumCard className="p-5">
          <p className="text-sm font-semibold text-white">Filtros</p>
          <form className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <label className="block">
              <span className="text-xs font-medium text-slate-400">Fecha desde</span>
              <input
                className="mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none"
                defaultValue={data.filters.dateFrom ?? ""}
                name="dateFrom"
                type="date"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-400">Fecha hasta</span>
              <input
                className="mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none"
                defaultValue={data.filters.dateTo ?? ""}
                name="dateTo"
                type="date"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-400">Fuente</span>
              <select
                className="mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none"
                defaultValue={data.filters.source}
                name="source"
              >
                <option className="bg-slate-950" value="all">todas</option>
                <option className="bg-slate-950" value="gmail">gmail</option>
                <option className="bg-slate-950" value="manual">manual</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-400">Estado</span>
              <select
                className="mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none"
                defaultValue={data.filters.status}
                name="status"
              >
                <option className="bg-slate-950" value="all">todos</option>
                <option className="bg-slate-950" value="procesado">procesado</option>
                <option className="bg-slate-950" value="duplicado">duplicado</option>
                <option className="bg-slate-950" value="omitido">omitido</option>
                <option className="bg-slate-950" value="error">error</option>
                <option className="bg-slate-950" value="pendiente">pendiente</option>
              </select>
            </label>
            <button className="om7-btn-primary mt-5 h-10 px-4" type="submit">
              Aplicar
            </button>
          </form>
        </PremiumCard>
      </section>

      {!data.gmailXmlEnabled ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/10 p-5">
          <p className="text-sm font-semibold text-amber-100">
            El diagnostico Gmail XML no esta habilitado para esta empresa.
          </p>
          <p className="mt-2 text-sm text-amber-100/75">
            Selecciona una empresa con Gmail XML habilitado para revisar
            documentos importados y trazabilidad.
          </p>
        </PremiumCard>
      ) : null}

      {data.kpis ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard label="XML registrados" value={data.kpis.totalXmlDocuments} />
            <KpiCard label="Desde Gmail" value={data.kpis.gmailDocuments} />
            <KpiCard label="Manual" value={data.kpis.manualDocuments} />
            <KpiCard
              label="Fecha mas antigua"
              value={formatDate(data.kpis.oldestDate)}
            />
            <KpiCard
              label="Fecha mas reciente"
              value={formatDate(data.kpis.newestDate)}
              detail={`Ultima sync: ${formatDateTime(data.kpis.lastSyncAt)}`}
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
            <PremiumCard className="overflow-hidden p-0">
              <div className="border-b border-white/[0.08] px-5 py-4">
                <p className="text-sm font-semibold text-white">
                  Conteo por estado Gmail
                </p>
              </div>
              <div className="divide-y divide-white/[0.06]">
                {data.statusCounts.map((item) => (
                  <div
                    className="flex items-center justify-between px-5 py-3 text-sm"
                    key={item.status}
                  >
                    <span className="text-slate-400">{item.status}</span>
                    <span className="font-semibold text-white">{item.count}</span>
                  </div>
                ))}
              </div>
            </PremiumCard>

            <PremiumCard className="overflow-hidden p-0">
              <div className="border-b border-white/[0.08] px-5 py-4">
                <p className="text-sm font-semibold text-white">
                  Conteo por mes
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead className="border-b border-white/[0.08] text-xs uppercase tracking-[0.16em] text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Mes</th>
                      <th className="px-5 py-3">Documentos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {data.monthlyCounts.map((item) => (
                      <tr key={item.month}>
                        <td className="px-5 py-3 text-slate-300">{item.month}</td>
                        <td className="px-5 py-3 font-semibold text-white">
                          {item.count}
                        </td>
                      </tr>
                    ))}
                    {data.monthlyCounts.length === 0 ? (
                      <tr>
                        <td className="px-5 py-8 text-center text-slate-500" colSpan={2}>
                          Sin documentos XML para el filtro actual.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </PremiumCard>
          </section>

          <PremiumCard className="overflow-hidden p-0">
            <div className="border-b border-white/[0.08] px-5 py-4">
              <p className="text-sm font-semibold text-white">
                Meses faltantes o con baja cantidad
              </p>
            </div>
            <div className="flex flex-wrap gap-2 p-5">
              {data.sparseMonths.map((item) => (
                <span className="om7-chip om7-chip-amber" key={item.month}>
                  {item.month}: {item.count} - {item.reason}
                </span>
              ))}
              {data.sparseMonths.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No se detectan huecos evidentes con el rango actual.
                </p>
              ) : null}
            </div>
          </PremiumCard>

          <PremiumCard className="overflow-hidden p-0">
            <div className="border-b border-white/[0.08] px-5 py-4">
              <p className="text-sm font-semibold text-white">
                Timeline de periodos historicos
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Estados guardados en OM7 para cargas por periodo.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="border-b border-white/[0.08] text-xs uppercase tracking-[0.16em] text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Periodo</th>
                    <th className="px-5 py-3">Rango</th>
                    <th className="px-5 py-3">Estado</th>
                    <th className="px-5 py-3">Encontrados</th>
                    <th className="px-5 py-3">Procesados</th>
                    <th className="px-5 py-3">Resultado</th>
                    <th className="px-5 py-3">Ultima sync</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {data.syncPeriods.map((period) => (
                    <tr key={period.id}>
                      <td className="px-5 py-3 font-medium text-white">
                        {period.period_key}
                      </td>
                      <td className="px-5 py-3 text-slate-400">
                        {period.date_from} a {period.date_to}
                      </td>
                      <td className="px-5 py-3 text-slate-300">
                        {period.status}
                      </td>
                      <td className="px-5 py-3 text-slate-300">
                        {period.found_count}
                      </td>
                      <td className="px-5 py-3 text-slate-300">
                        {period.processed_count}
                      </td>
                      <td className="px-5 py-3 text-slate-400">
                        {period.imported_count} imp / {period.duplicated_count} dup /{" "}
                        {period.omitted_count} omit / {period.error_count} err
                      </td>
                      <td className="px-5 py-3 text-slate-400">
                        {formatDateTime(period.last_synced_at)}
                      </td>
                    </tr>
                  ))}
                  {data.syncPeriods.length === 0 ? (
                    <tr>
                      <td className="px-5 py-8 text-center text-slate-500" colSpan={7}>
                        Aun no hay periodos historicos registrados.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </PremiumCard>

          <section className="grid gap-5 xl:grid-cols-2">
            <PremiumCard className="overflow-hidden p-0">
              <div className="border-b border-white/[0.08] px-5 py-4">
                <p className="text-sm font-semibold text-white">
                  Ultimos 20 documentos importados
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-b border-white/[0.08] text-xs uppercase tracking-[0.16em] text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Documento</th>
                      <th className="px-5 py-3">Fuente</th>
                      <th className="px-5 py-3">Fecha</th>
                      <th className="px-5 py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {data.latestDocuments.map((document) => (
                      <tr key={document.id}>
                        <td className="px-5 py-3">
                          <Link
                            className="font-medium text-cyan-100 underline decoration-cyan-100/30 underline-offset-4"
                            href={`/documentos/${document.id}`}
                          >
                            {document.original_filename ?? "documento.xml"}
                          </Link>
                        </td>
                        <td className="px-5 py-3 text-slate-300">{document.source}</td>
                        <td className="px-5 py-3 text-slate-400">
                          {formatDate(document.business_date)}
                        </td>
                        <td className="px-5 py-3 text-slate-300">
                          {document.processing_status ?? "N/D"}
                        </td>
                      </tr>
                    ))}
                    {data.latestDocuments.length === 0 ? (
                      <tr>
                        <td className="px-5 py-8 text-center text-slate-500" colSpan={4}>
                          Sin documentos para mostrar.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </PremiumCard>

            <PremiumCard className="overflow-hidden p-0">
              <div className="border-b border-white/[0.08] px-5 py-4">
                <p className="text-sm font-semibold text-white">
                  Ultimos 20 errores
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-b border-white/[0.08] text-xs uppercase tracking-[0.16em] text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Adjunto</th>
                      <th className="px-5 py-3">Estado</th>
                      <th className="px-5 py-3">Error</th>
                      <th className="px-5 py-3">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {data.latestErrors.map((item) => (
                      <tr key={item.id}>
                        <td className="px-5 py-3 text-cyan-100">
                          {item.attachment_filename ?? "documento.xml"}
                        </td>
                        <td className="px-5 py-3 text-slate-300">
                          {item.import_status}
                        </td>
                        <td className="px-5 py-3 text-rose-100/85">
                          {item.error_message ?? "Sin detalle"}
                        </td>
                        <td className="px-5 py-3 text-slate-400">
                          {formatDateTime(item.created_at)}
                        </td>
                      </tr>
                    ))}
                    {data.latestErrors.length === 0 ? (
                      <tr>
                        <td className="px-5 py-8 text-center text-slate-500" colSpan={4}>
                          Sin errores recientes.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </PremiumCard>
          </section>
        </>
      ) : null}
    </ModuleFrame>
  );
}
