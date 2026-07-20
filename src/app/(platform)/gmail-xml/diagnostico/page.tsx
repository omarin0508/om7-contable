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

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    minimumFractionDigits: 2,
  }).format(value ?? 0);
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

function getProviderSort(value: string | null | undefined) {
  return value === "iva" ||
    value === "cantidad" ||
    value === "fecha" ||
    value === "monto"
    ? value
    : "monto";
}

function buildDiagnosticReportHref(filters: GmailXmlDiagnosticsFilters) {
  const params = new URLSearchParams();

  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.source && filters.source !== "all") params.set("source", filters.source);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);

  const query = params.toString();

  return `/gmail-xml/diagnostico/reporte.xlsx${query ? `?${query}` : ""}`;
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
  const providerQuery = (getParam(params, "providerQuery") ?? "").trim();
  const providerSort = getProviderSort(getParam(params, "providerSort"));
  const reportHref = buildDiagnosticReportHref(data.filters);
  const activeCompanyName =
    data.activeContext.activeCompany?.legal_name ??
    data.activeContext.activeCompany?.name ??
    "Sin empresa activa";
  const activeOrganizationName =
    data.activeContext.organization?.name ?? "Sin organizacion activa";
  const normalizedProviderQuery = providerQuery.toLowerCase();
  const providerRows = (data.providerSummary ?? [])
    .filter((provider) => {
      if (!normalizedProviderQuery) {
        return true;
      }

      return [
        provider.providerName,
        provider.providerTaxId,
        provider.linkedCounterpartyName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedProviderQuery);
    })
    .sort((left, right) => {
      if (providerSort === "iva") {
        return right.iva - left.iva;
      }

      if (providerSort === "cantidad") {
        return right.documentsCount - left.documentsCount;
      }

      if (providerSort === "fecha") {
        return String(right.newestDate ?? "").localeCompare(
          String(left.newestDate ?? ""),
        );
      }

      return right.total - left.total;
    });
  const ivaMatrixRates = data.documentIvaMatrix.rates;
  const ivaMatrixRows = data.documentIvaMatrix.rows;

  return (
    <ModuleFrame>
      <ModuleHeader
        title={`Diagnostico Gmail XML - ${activeCompanyName}`}
        description="Workspace de solo lectura sobre la base de datos OM7. No busca correos en Gmail ni importa documentos."
        action={
          <div className="flex flex-wrap gap-2">
            <Link className="om7-btn-primary px-4 py-2.5" href={reportHref}>
              Exportar Excel
            </Link>
            <Link className="om7-btn-ghost px-4 py-2.5" href="/gmail-xml">
              Volver a Gmail XML
            </Link>
          </div>
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
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <KpiCard
              label="XML en base"
              value={data.kpis.totalXmlDocuments}
              detail={`${data.kpis.gmailDocuments} Gmail / ${data.kpis.manualDocuments} manual`}
            />
            <KpiCard
              label="IVA total en base"
              value={formatCurrency(data.kpis.totalIva)}
              detail={
                data.kpis.duplicatesCount > 0
                  ? `${data.kpis.duplicatesCount} duplicado(s) excluidos`
                  : "Sin duplicados fiscales detectados"
              }
            />
            <KpiCard
              label="Desde"
              value={formatDate(data.kpis.fiscalDateMin)}
              detail="Fecha fiscal"
            />
            <KpiCard
              label="Hasta"
              value={formatDate(data.kpis.fiscalDateMax)}
              detail="Fecha fiscal"
            />
            <KpiCard
              label="Ultima sincronizacion"
              value={formatDateTime(data.kpis.lastSyncAt)}
            />
            <KpiCard
              label="Ultimos errores"
              value={data.latestErrors.length}
              detail={
                data.latestErrors.length > 0
                  ? "Revisar detalle inferior"
                  : "Sin errores recientes"
              }
            />
          </section>

          <PremiumCard className="border-cyan-300/10 bg-cyan-300/5 p-4">
            <p className="text-sm text-slate-300">
              Este diagnostico resume la data XML ya guardada para la empresa
              activa. La base contiene documentos desde{" "}
              <span className="font-medium text-cyan-100">
                {formatDate(data.kpis.fiscalDateMin)}
              </span>{" "}
              hasta{" "}
              <span className="font-medium text-cyan-100">
                {formatDate(data.kpis.fiscalDateMax)}
              </span>
              . El rango usa la fecha fiscal del comprobante cuando esta
              disponible.
              {data.kpis.fiscalDateFallbackCount > 0
                ? ` ${data.kpis.fiscalDateFallbackCount} documento(s) usaron fecha de carga por no tener fecha fiscal extraida.`
                : ""}
            </p>
          </PremiumCard>

          <section className="space-y-4">
            <div>
              <p className="text-lg font-semibold tracking-tight text-white">
                IVA acumulado por tarifa
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Clasificacion por linea XML; una factura con varias tarifas se
                reparte entre las clases correspondientes.
              </p>
            </div>

            <PremiumCard className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="border-b border-white/[0.08] text-xs uppercase tracking-[0.16em] text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Clase IVA</th>
                      <th className="px-5 py-3">Docs</th>
                      <th className="px-5 py-3">Lineas</th>
                      <th className="px-5 py-3">Base</th>
                      <th className="px-5 py-3">IVA</th>
                      <th className="px-5 py-3">Porcion total</th>
                      <th className="px-5 py-3">% del total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {data.ivaRateSummary.map((item) => (
                      <tr key={item.rateKey}>
                        <td className="px-5 py-3 font-medium text-white">
                          {item.rateLabel}
                        </td>
                        <td className="px-5 py-3 text-slate-300">
                          {item.documentsCount}
                        </td>
                        <td className="px-5 py-3 text-slate-300">
                          {item.linesCount}
                        </td>
                        <td className="px-5 py-3 text-slate-300">
                          {formatCurrency(item.taxableBase)}
                        </td>
                        <td className="px-5 py-3 text-cyan-100">
                          {formatCurrency(item.iva)}
                        </td>
                        <td className="px-5 py-3 font-semibold text-white">
                          {formatCurrency(item.totalPortion)}
                        </td>
                        <td className="px-5 py-3 text-slate-300">
                          {item.totalShare.toLocaleString("es-CR", {
                            maximumFractionDigits: 2,
                            minimumFractionDigits: 2,
                          })}
                          %
                        </td>
                      </tr>
                    ))}
                    {data.ivaRateSummary.length === 0 ? (
                      <tr>
                        <td className="px-5 py-8 text-center text-slate-500" colSpan={7}>
                          Sin lineas XML para clasificar IVA.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </PremiumCard>
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-lg font-semibold tracking-tight text-white">
                Facturas por clase de IVA
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Una fila por factura deduplicada, con columnas por tarifa de IVA
                detectada en las lineas XML.
              </p>
            </div>

            <PremiumCard className="overflow-hidden p-0">
              <div className="max-h-[520px] overflow-auto">
                <table
                  className="w-full text-left text-sm"
                  style={{
                    minWidth: `${1040 + ivaMatrixRates.length * 150}px`,
                  }}
                >
                  <thead className="sticky top-0 border-b border-white/[0.08] bg-slate-950 text-xs uppercase tracking-[0.16em] text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Fecha</th>
                      <th className="px-5 py-3">Proveedor</th>
                      <th className="px-5 py-3">Comprobante</th>
                      <th className="px-5 py-3">Clases</th>
                      {ivaMatrixRates.map((rate) => (
                        <th className="px-5 py-3" key={rate.rateKey}>
                          {rate.rateLabel}
                        </th>
                      ))}
                      <th className="px-5 py-3">IVA total</th>
                      <th className="px-5 py-3">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {ivaMatrixRows.map((document) => {
                      const classesByRate = new Map(
                        document.ivaClasses.map((item) => [item.rateKey, item]),
                      );

                      return (
                        <tr key={document.documentId}>
                          <td className="px-5 py-3 text-slate-400">
                            {formatDate(document.fiscalDate)}
                          </td>
                          <td className="px-5 py-3 font-medium text-white">
                            {document.providerName}
                          </td>
                          <td className="px-5 py-3 text-slate-400">
                            {document.documentNumber ?? document.filename}
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={
                                document.hasMultipleIvaClasses
                                  ? "om7-chip om7-chip-amber"
                                  : "om7-chip"
                              }
                            >
                              {document.ivaClassLabels.join(" + ") || "Sin clase"}
                            </span>
                          </td>
                          {ivaMatrixRates.map((rate) => {
                            const classAmount = classesByRate.get(rate.rateKey);

                            return (
                              <td className="px-5 py-3 text-cyan-100" key={rate.rateKey}>
                                {classAmount ? formatCurrency(classAmount.iva) : "-"}
                              </td>
                            );
                          })}
                          <td className="px-5 py-3 font-semibold text-white">
                            {formatCurrency(document.iva)}
                          </td>
                          <td className="px-5 py-3 font-semibold text-white">
                            {formatCurrency(document.total)}
                          </td>
                        </tr>
                      );
                    })}
                    {ivaMatrixRows.length === 0 ? (
                      <tr>
                        <td
                          className="px-5 py-8 text-center text-slate-500"
                          colSpan={6 + ivaMatrixRates.length}
                        >
                          Sin facturas XML para clasificar por tarifa.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                  {ivaMatrixRows.length > 0 ? (
                    <tfoot className="border-t border-white/[0.08] bg-black/20 text-sm font-semibold text-white">
                      <tr>
                        <td className="px-5 py-3" colSpan={4}>
                          Total clases IVA
                        </td>
                        {ivaMatrixRates.map((rate) => (
                          <td className="px-5 py-3 text-cyan-100" key={rate.rateKey}>
                            {formatCurrency(rate.iva)}
                          </td>
                        ))}
                        <td className="px-5 py-3">
                          {formatCurrency(
                            ivaMatrixRows.reduce((sum, item) => sum + item.iva, 0),
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {formatCurrency(
                            ivaMatrixRows.reduce((sum, item) => sum + item.total, 0),
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
              </div>
            </PremiumCard>
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-lg font-semibold tracking-tight text-white">
                  Resumen por proveedor
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Clasificacion ejecutiva de XML en base por emisor detectado.
                </p>
              </div>
              <Link
                className="om7-btn-primary px-4 py-2.5"
                href={reportHref}
              >
                Exportar diagnostico Excel
              </Link>
            </div>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <KpiCard
                label="Proveedores detectados"
                value={data.kpis.totalProviders}
              />
              <KpiCard
                label="Mayor monto"
                value={data.providerHighlights.topProviderByTotal?.providerName ?? "N/D"}
                detail={formatCurrency(data.providerHighlights.topProviderByTotal?.total)}
              />
              <KpiCard
                label="Mayor IVA"
                value={data.providerHighlights.topProviderByIva?.providerName ?? "N/D"}
                detail={formatCurrency(data.providerHighlights.topProviderByIva?.iva)}
              />
              <KpiCard
                label="Sin proveedor"
                value={data.kpis.documentsWithoutProvider}
              />
              <KpiCard
                label="Pendientes convertir"
                value={data.kpis.pendingConversion}
              />
            </section>

            <PremiumCard className="overflow-hidden p-0">
              <div className="border-b border-white/[0.08] px-5 py-4">
                <form className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
                  <input
                    className="h-10 rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none placeholder:text-slate-600"
                    defaultValue={providerQuery}
                    name="providerQuery"
                    placeholder="Buscar proveedor o tax_id..."
                  />
                  <select
                    className="h-10 rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none"
                    defaultValue={providerSort}
                    name="providerSort"
                  >
                    <option className="bg-slate-950" value="monto">Ordenar por monto</option>
                    <option className="bg-slate-950" value="iva">Ordenar por IVA</option>
                    <option className="bg-slate-950" value="cantidad">Ordenar por cantidad</option>
                    <option className="bg-slate-950" value="fecha">Ordenar por fecha reciente</option>
                  </select>
                  <button className="om7-btn-secondary h-10 px-4" type="submit">
                    Filtrar
                  </button>
                </form>
              </div>
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full min-w-[1180px] text-left text-sm">
                  <thead className="sticky top-0 border-b border-white/[0.08] bg-slate-950 text-xs uppercase tracking-[0.16em] text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Proveedor</th>
                      <th className="px-5 py-3">Tax ID</th>
                      <th className="px-5 py-3">Docs</th>
                      <th className="px-5 py-3">Subtotal</th>
                      <th className="px-5 py-3">IVA</th>
                      <th className="px-5 py-3">Total</th>
                      <th className="px-5 py-3">Promedio</th>
                      <th className="px-5 py-3">Desde</th>
                      <th className="px-5 py-3">Hasta</th>
                      <th className="px-5 py-3">Ultima importacion</th>
                      <th className="px-5 py-3">Clasificacion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {providerRows.map((provider) => (
                      <tr key={`${provider.providerName}-${provider.providerTaxId ?? "sin-tax"}`}>
                        <td className="px-5 py-3 font-medium text-white">
                          {provider.providerName}
                        </td>
                        <td className="px-5 py-3 text-slate-400">
                          {provider.providerTaxId ?? "N/D"}
                        </td>
                        <td className="px-5 py-3 text-slate-300">
                          {provider.documentsCount}
                        </td>
                        <td className="px-5 py-3 text-slate-300">
                          {formatCurrency(provider.subtotal)}
                        </td>
                        <td className="px-5 py-3 text-cyan-100">
                          {formatCurrency(provider.iva)}
                        </td>
                        <td className="px-5 py-3 font-semibold text-white">
                          {formatCurrency(provider.total)}
                        </td>
                        <td className="px-5 py-3 text-slate-300">
                          {formatCurrency(provider.averagePerDocument)}
                        </td>
                        <td className="px-5 py-3 text-slate-400">
                          {formatDate(provider.oldestDate)}
                        </td>
                        <td className="px-5 py-3 text-slate-400">
                          {formatDate(provider.newestDate)}
                        </td>
                        <td className="px-5 py-3 text-slate-400">
                          {formatDateTime(provider.lastImportAt)}
                        </td>
                        <td className="px-5 py-3">
                          <span className="om7-chip">
                            {provider.classificationStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {providerRows.length === 0 ? (
                      <tr>
                        <td className="px-5 py-8 text-center text-slate-500" colSpan={11}>
                          Sin proveedores para el filtro actual.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </PremiumCard>
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
