import Link from "next/link";
import { DocumentDetailTabs } from "@/components/documents/document-detail-tabs";
import {
  DocumentSearchSelect,
  type DocumentSearchOption,
} from "@/components/documents/document-search-select";
import { ModuleFrame, StatusBadge } from "@/components/modules/shared";
import { PremiumCard } from "@/components/ui/premium-card";
import { normalizeCurrencyCode } from "@/lib/currency";
import { getDocumentHumanStatus } from "@/lib/document-ui";
import { listDocumentsByCompany } from "@/lib/storage";

type DocumentsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type DocumentItem = Awaited<ReturnType<typeof listDocumentsByCompany>>["documents"][number];

const quickFilters = [
  { href: "/documentos?lifecycle=active", label: "Activos" },
  { href: "/documentos?status=Requiere revision", label: "Pendientes" },
  { href: "/documentos?provider=xml-parser-cr", label: "XML" },
  { href: "/documentos?kind=pdf-image", label: "PDF/imagen" },
  { href: "/documentos?provider=openai-vision", label: "IA Vision" },
  { href: "/documentos?status=Listo para convertir", label: "Revisados" },
  { href: "/documentos?lifecycle=archived", label: "Archivados" },
  { href: "/documentos?status=Error / requiere atencion", label: "Errores" },
];

const lifecycleOptions = [
  { label: "Todos", value: "all" },
  { label: "Activos", value: "active" },
  { label: "Archivados", value: "archived" },
  { label: "Inactivos", value: "inactive" },
  { label: "Eliminados", value: "deleted" },
];

const statusOptions = [
  "all",
  "Recibido",
  "Requiere revision",
  "Listo para convertir",
  "Convertido a compra",
  "Convertido a factura",
  "Observado",
  "Error / requiere atencion",
  "Procesado",
  "Revisado",
  "Subido",
];

const providerLabels: Record<string, string> = {
  "xml-parser-cr": "XML",
  "openai-vision": "IA Vision",
  manual: "Manual",
  none: "Sin extraccion",
};

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function normalizeLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isXmlDocument(document: {
  mime_type: string | null;
  original_filename: string | null;
}) {
  return (
    document.mime_type?.includes("xml") ||
    document.original_filename?.toLowerCase().endsWith(".xml") ||
    false
  );
}

function isPdfOrImageDocument(document: {
  mime_type: string | null;
  original_filename: string | null;
}) {
  const mimeType = document.mime_type ?? "";
  const filename = document.original_filename?.toLowerCase() ?? "";

  return (
    mimeType === "application/pdf" ||
    mimeType.startsWith("image/") ||
    filename.endsWith(".pdf")
  );
}

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

function formatBytes(value: number | null) {
  const bytes = Number(value ?? 0);

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kilobytes = bytes / 1024;

  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(1)} KB`;
  }

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

function getData(document: DocumentItem) {
  const data = document.extraction?.extracted_data ?? {};

  return data && typeof data === "object" && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : {};
}

function getValue(data: Record<string, unknown>, keys: string[], fallback = "No disponible") {
  for (const key of keys) {
    const value = data[key];

    if (value !== null && value !== undefined && value !== "") {
      return String(value);
    }
  }

  return fallback;
}

function getNumberValue(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = Number(data[key] ?? 0);

    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return 0;
}

function getMoney(data: Record<string, unknown>) {
  const amount = getNumberValue(data, ["total"]);

  if (amount <= 0) {
    return "No disponible";
  }

  return `${normalizeCurrencyCode(data.moneda ?? data.currency)} ${amount.toLocaleString(
    "es-CR",
    {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    },
  )}`;
}

function getConfidenceLabel(document: DocumentItem) {
  const value = Number(document.extraction?.confidence ?? 0);

  if (!Number.isFinite(value) || value <= 0) {
    return "Sin IA";
  }

  const normalized = value > 1 ? value : value * 100;

  return `${Math.round(normalized)}%`;
}

function getDocumentState(document: DocumentItem) {
  const humanState = getDocumentHumanStatus(document).label;

  return humanState
    .replace("revisión", "revision")
    .replace("atención", "atencion");
}

function getLifecycleState(document: DocumentItem) {
  if (document.deleted_at) {
    return "deleted";
  }

  if (document.inactive_at) {
    return "inactive";
  }

  if (document.archived_at) {
    return "archived";
  }

  return "active";
}

function getLifecycleLabel(document: DocumentItem) {
  const lifecycle = getLifecycleState(document);

  if (lifecycle === "deleted") {
    return "Eliminado";
  }

  if (lifecycle === "inactive") {
    return "Inactivo";
  }

  if (lifecycle === "archived") {
    return "Archivado";
  }

  return "Activo";
}

function getProvider(document: DocumentItem) {
  return document.extraction?.extraction_provider ?? "none";
}

function getDocumentKind(document: DocumentItem) {
  if (isXmlDocument(document)) {
    return "XML";
  }

  if (document.mime_type === "application/pdf") {
    return "PDF";
  }

  if (document.mime_type?.startsWith("image/")) {
    return "Imagen";
  }

  return "Documento";
}

function getRelation(document: DocumentItem) {
  if (document.converted_type === "purchase" || document.related_type === "purchase") {
    return { href: "/compras", label: "Compra relacionada" };
  }

  if (document.converted_type === "invoice" || document.related_type === "invoice") {
    return { href: "/facturas", label: "Factura relacionada" };
  }

  return null;
}

function matchesFilter(document: DocumentItem, filters: Record<string, string>) {
  const data = getData(document);
  const state = getDocumentState(document);
  const provider = getProvider(document);
  const query = filters.q?.toLowerCase().trim();
  const lifecycle = getLifecycleState(document);
  const documentDate =
    getValue(data, ["fecha_emision", "date"], document.created_at ?? "").slice(0, 10);

  if (filters.lifecycle && filters.lifecycle !== "all" && lifecycle !== filters.lifecycle) {
    return false;
  }

  if (
    filters.status &&
    filters.status !== "all" &&
    normalizeLabel(state) !== normalizeLabel(filters.status)
  ) {
    return false;
  }

  if (
    filters.documentType &&
    filters.documentType !== "all" &&
    document.document_type !== filters.documentType
  ) {
    return false;
  }

  if (filters.provider && filters.provider !== "all" && provider !== filters.provider) {
    return false;
  }

  if (filters.date && documentDate !== filters.date) {
    return false;
  }

  if (filters.kind === "xml" && !isXmlDocument(document)) {
    return false;
  }

  if (filters.kind === "pdf-image" && !isPdfOrImageDocument(document)) {
    return false;
  }

  if (query) {
    const haystack = [
      document.display_name,
      document.original_filename,
      document.document_type,
      document.notes,
      getValue(data, ["emisor_nombre", "supplier_name"], ""),
      getValue(data, ["receptor_nombre", "customer_name"], ""),
      getValue(data, ["numero_consecutivo", "document_number"], ""),
      getValue(data, ["fecha_emision", "date"], ""),
      getValue(data, ["clave"], ""),
      getMoney(data),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  }

  return true;
}

function buildArchiveHref({
  documentId,
  filters,
}: {
  documentId?: string;
  filters: Record<string, string>;
}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value && value !== "all" && key !== "doc") {
      params.set(key, value);
    }
  }

  if (documentId) {
    params.set("doc", documentId);
  }

  const query = params.toString();

  return `/documentos${query ? `?${query}` : ""}`;
}

function SmallCounter({
  label,
  tone = "default",
  value,
}: {
  label: string;
  tone?: "amber" | "cyan" | "default" | "emerald" | "rose";
  value: number;
}) {
  const toneClass = {
    amber: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    cyan: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
    default: "border-white/[0.08] bg-white/[0.04] text-slate-100",
    emerald: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
    rose: "border-rose-300/20 bg-rose-300/10 text-rose-100",
  }[tone];

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 ${toneClass}`}>
      <span className="text-sm font-semibold leading-none">{value}</span>
      <span className="text-xs text-current/70">{label}</span>
    </div>
  );
}

function DocumentDetail({
  backHref,
  document,
}: {
  backHref: string;
  document: DocumentItem;
}) {
  const data = getData(document);
  const relation = getRelation(document);
  const provider = getProvider(document);
  const tax = getNumberValue(data, ["impuesto", "tax"]);
  const issuer = getValue(
    data,
    ["emisor_nombre", "supplier_name"],
    document.display_name || document.original_filename || "Documento",
  );
  const documentDate = getValue(data, ["fecha_emision", "date"], formatDate(document.created_at));
  const total = getMoney(data);
  const summaryItems = [
    ["Proveedor / emisor", issuer],
    ["Estado", getDocumentState(document)],
    ["Monto", total],
    ["Origen", providerLabels[provider] ?? provider],
    ["Tipo", document.document_type],
    ["Relacion", relation?.label ?? "Sin relacion"],
    ["Fecha", documentDate],
  ].map(([label, value]) => ({ label, value }));
  const extractionItems = [
    ["Emisor", issuer],
    ["Receptor", getValue(data, ["receptor_nombre", "customer_name"])],
    ["Clave", getValue(data, ["clave"])],
    ["Consecutivo", getValue(data, ["numero_consecutivo", "document_number"])],
    ["Fecha", documentDate],
    ["Moneda", normalizeCurrencyCode(data.moneda ?? data.currency)],
    ["IVA", tax > 0 ? tax.toLocaleString("es-CR") : "Sin IVA"],
    ["Total", total],
  ].map(([label, value]) => ({ label, value }));
  const traceItems = [
    ["Origen", providerLabels[provider] ?? provider],
    ["Estado", getDocumentState(document)],
    ["Ciclo", getLifecycleLabel(document)],
    ["Tipo", document.document_type],
    ["Usuario", document.user_id],
    ["Ingreso", formatDate(document.created_at)],
    ["Conversion", document.converted_type ?? "Sin conversion"],
    ["Registro relacionado", document.converted_record_id ?? "Sin relacion"],
  ].map(([label, value]) => ({ label, value }));
  const historyItems = [
    ["Proveedor extraccion", document.extraction?.extraction_provider ?? "Sin extraccion"],
    ["Estado extraccion", document.extraction?.extraction_status ?? "Sin estado"],
    ["Procesado", formatDate(document.extraction?.processed_at)],
    ["Actualizado", formatDate(document.updated_at)],
  ].map(([label, value]) => ({ label, value }));

  return (
    <section className="grid max-h-[calc(100vh-9rem)] min-h-[min(40rem,calc(100vh-10rem))] grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden">
      <PremiumCard className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <Link className="om7-btn-ghost mb-4 inline-flex px-3 py-2 text-sm" href={backHref}>
              &lt;- Volver a consulta
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge>{getDocumentState(document)}</StatusBadge>
              <span className="om7-chip text-slate-400">{getDocumentKind(document)}</span>
              <span className="om7-chip om7-chip-cyan">
                {providerLabels[provider] ?? provider}
              </span>
              <span className="om7-chip text-slate-400">
                Confianza {getConfidenceLabel(document)}
              </span>
              {relation ? <span className="om7-chip om7-chip-emerald">{relation.label}</span> : null}
            </div>
            <h2 className="mt-4 break-words text-2xl font-semibold tracking-tight text-white">
              {issuer}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {document.original_filename || document.display_name || "Sin archivo"} ·{" "}
              {formatBytes(document.size_bytes)} · ingresado {formatDate(document.created_at)}
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Monto", total],
                ["Fecha", documentDate],
                ["Origen", providerLabels[provider] ?? provider],
                ["Relacion", relation?.label ?? "Sin relacion"],
              ].map(([label, value]) => (
                <div className="rounded-xl border border-white/[0.07] bg-black/15 px-3 py-2" key={label}>
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-100">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {relation ? (
              <Link className="om7-btn-secondary px-4 py-2.5" href={relation.href}>
                {relation.label}
              </Link>
            ) : null}
            <Link className="om7-btn-ghost px-4 py-2.5" href={`/documentos/${document.id}`}>
              Ver trazabilidad completa
            </Link>
          </div>
        </div>
      </PremiumCard>

      <DocumentDetailTabs
        extractionItems={extractionItems}
        historyItems={historyItems}
        originalLabel="Ver original"
        preview={{
          alt: document.display_name || document.original_filename || "Documento",
          mimeType: document.mime_type,
          signedUrl: document.signedUrl,
        }}
        summaryItems={summaryItems}
        traceItems={traceItems}
      />
    </section>
  );
}

function toSearchOption(
  document: DocumentItem,
  filters: Record<string, string>,
): DocumentSearchOption {
  const data = getData(document);
  const provider = getProvider(document);

  return {
    amount: getMoney(data),
    date: getValue(data, ["fecha_emision", "date"], formatDate(document.created_at)),
    href: buildArchiveHref({ documentId: document.id, filters }),
    kind: getDocumentKind(document),
    origin: providerLabels[provider] ?? provider,
    status: getDocumentState(document),
    subtitle: getValue(
      data,
      ["numero_consecutivo", "document_number", "clave"],
      document.original_filename || "Sin consecutivo",
    ),
    title: getValue(
      data,
      ["emisor_nombre", "supplier_name"],
      document.display_name || document.original_filename || "Documento",
    ),
  };
}

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const params = (await searchParams) ?? {};
  const filters = {
    date: getParam(params, "date") ?? "",
    documentType: getParam(params, "documentType") ?? "all",
    kind: getParam(params, "kind") ?? "all",
    lifecycle: getParam(params, "lifecycle") ?? "all",
    provider: getParam(params, "provider") ?? "all",
    q: getParam(params, "q") ?? "",
    status: getParam(params, "status") ?? "all",
  };
  const selectedDocumentId = getParam(params, "doc") ?? "";
  const { activeContext, documents } = await listDocumentsByCompany();
  const activeCompany = activeContext.activeCompany;
  const filteredDocuments = documents.filter((document) =>
    matchesFilter(document, filters),
  );
  const searchOptions = filteredDocuments.map((document) =>
    toSearchOption(document, filters),
  );
  const selectedDocument = selectedDocumentId
    ? documents.find((document) => document.id === selectedDocumentId) ?? null
    : null;
  const today = new Date().toISOString().slice(0, 10);
  const pendingReviewCount = documents.filter(
    (document) => normalizeLabel(getDocumentState(document)) === "requiere revision",
  ).length;
  const convertedCount = documents.filter((document) =>
    ["purchase", "invoice"].includes(document.converted_type ?? ""),
  ).length;
  const observedCount = documents.filter((document) =>
    normalizeLabel(getDocumentState(document)).includes("observado") ||
    normalizeLabel(getDocumentState(document)).includes("error") ||
    normalizeLabel(getDocumentState(document)).includes("atencion"),
  ).length;
  const recentActivityCount = documents.filter(
    (document) => document.created_at?.slice(0, 10) === today,
  ).length;
  const backHref = buildArchiveHref({ filters });

  return (
    <ModuleFrame>
      <section className="rounded-2xl border border-white/[0.08] bg-[#06101c]/95 p-4 shadow-xl shadow-black/20 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/60">
              Archivo documental
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
              Consulta de documentos ingresados
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Archivo de evidencia para revisar XML, PDF, imagenes, trazabilidad y registros relacionados.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="om7-btn-secondary px-4 py-2.5" href="/bandeja">
              Ir a Bandeja
            </Link>
            {selectedDocument ? (
              <Link className="om7-btn-ghost px-4 py-2.5" href={backHref}>
                Limpiar seleccion
              </Link>
            ) : null}
            <Link className="om7-btn-ghost px-4 py-2.5" href="/documentos">
              Refrescar
            </Link>
          </div>
        </div>
      </section>

      {!activeCompany ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/10 p-5">
          <p className="text-sm font-medium text-amber-100">
            Selecciona una empresa activa
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-100/75">
            La consulta documental usa el cliente/empresa activa.
          </p>
          <Link
            className="mt-4 inline-flex rounded-xl border border-amber-200/20 bg-black/15 px-4 py-2 text-sm font-medium text-amber-100 transition hover:bg-black/25"
            href="/empresas"
          >
            Ir a empresas
          </Link>
        </PremiumCard>
      ) : null}

      {selectedDocument ? (
        <DocumentDetail backHref={backHref} document={selectedDocument} />
      ) : (
        <>
          <PremiumCard className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <form
                className="grid flex-1 gap-3 xl:grid-cols-[170px_170px_170px_auto]"
                id="documents-filter-form"
                method="get"
              >
                <select
                  className="h-12 rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none"
                  defaultValue={filters.status}
                  name="status"
                >
                  {statusOptions.map((status) => (
                    <option className="bg-slate-950" key={status} value={status}>
                      {status === "all" ? "Estado: todos" : status}
                    </option>
                  ))}
                </select>
                <select
                  className="h-12 rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none"
                  defaultValue={filters.documentType}
                  name="documentType"
                >
                  {["all", "factura", "compra", "contrato", "estado_cuenta", "otro"].map((type) => (
                    <option className="bg-slate-950" key={type} value={type}>
                      {type === "all" ? "Tipo: todos" : type}
                    </option>
                  ))}
                </select>
                <select
                  className="h-12 rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none"
                  defaultValue={filters.provider}
                  name="provider"
                >
                  <option className="bg-slate-950" value="all">
                    Origen: todos
                  </option>
                  <option className="bg-slate-950" value="xml-parser-cr">
                    XML
                  </option>
                  <option className="bg-slate-950" value="openai-vision">
                    IA Vision
                  </option>
                  <option className="bg-slate-950" value="manual">
                    Manual
                  </option>
                  <option className="bg-slate-950" value="none">
                    Sin extraccion
                  </option>
                </select>
                <button className="om7-btn-secondary h-12 px-4" type="submit">
                  Filtrar
                </button>
              </form>
              <div className="flex flex-wrap gap-2 xl:justify-end">
                <SmallCounter label="total" tone="cyan" value={documents.length} />
                <SmallCounter label="pendientes" tone="amber" value={pendingReviewCount} />
                <SmallCounter label="convertidos" tone="emerald" value={convertedCount} />
                <SmallCounter label="observados" tone="rose" value={observedCount} />
                <SmallCounter label="hoy" value={recentActivityCount} />
              </div>
            </div>

            <details className="mt-4 rounded-2xl border border-white/[0.08] bg-black/15 p-3">
              <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Filtros avanzados
              </summary>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <input
                  className="h-10 rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none"
                  defaultValue={filters.date}
                  form="documents-filter-form"
                  name="date"
                  type="date"
                />
                {quickFilters.map((filter) => (
                  <Link
                    className="om7-chip transition hover:border-cyan-300/25 hover:bg-cyan-300/10 hover:text-cyan-100"
                    href={filter.href}
                    key={filter.href}
                  >
                    {filter.label}
                  </Link>
                ))}
                {lifecycleOptions.map((option) => (
                  <Link
                    className={[
                      "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                      filters.lifecycle === option.value
                        ? "border-cyan-300/30 bg-cyan-300/12 text-cyan-100"
                        : "border-white/[0.08] bg-white/[0.04] text-slate-400 hover:text-white",
                    ].join(" ")}
                    href={buildArchiveHref({
                      filters: { ...filters, lifecycle: option.value },
                    })}
                    key={option.value}
                  >
                    {option.label}
                  </Link>
                ))}
              </div>
            </details>
          </PremiumCard>

          <section>
            <PremiumCard className="p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-base font-semibold text-white">
                    Selector documental
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Escriba, despliegue y seleccione un documento para consultar su detalle.
                  </p>
                </div>
                <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-slate-400">
                  {filteredDocuments.length} de {documents.length}
                </span>
              </div>

              <div className="mt-5">
                <DocumentSearchSelect
                  initialQuery={filters.q}
                  options={searchOptions}
                />
              </div>
            </PremiumCard>
          </section>
        </>
      )}
    </ModuleFrame>
  );
}
