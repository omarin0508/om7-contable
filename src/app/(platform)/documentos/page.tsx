import Link from "next/link";
import { uploadDocumentAction } from "@/app/(platform)/documentos/actions";
import { DocumentInboxList } from "@/components/documents/document-inbox-list";
import { ModuleFrame } from "@/components/modules/shared";
import { PremiumCard } from "@/components/ui/premium-card";
import { getDocumentHumanStatus } from "@/lib/document-ui";
import { listDocumentsByCompany } from "@/lib/storage";

type DocumentsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type DocumentItem = Awaited<ReturnType<typeof listDocumentsByCompany>>["documents"][number];

const quickFilters = [
  { href: "/documentos?lifecycle=active", label: "Activos" },
  { href: "/documentos?status=Requiere revisión&lifecycle=active", label: "Pendientes" },
  { href: "/documentos?provider=xml-parser-cr", label: "XML" },
  { href: "/documentos?provider=openai-vision", label: "IA Vision" },
  { href: "/documentos?status=Listo para convertir", label: "Revisados" },
  { href: "/documentos?lifecycle=archived", label: "Archivados" },
  { href: "/documentos?status=Error / requiere atención", label: "Errores" },
];

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
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

function isAiProcessableDocument(document: {
  mime_type: string | null;
  original_filename: string | null;
}) {
  const mimeType = document.mime_type ?? "";
  const filename = document.original_filename?.toLowerCase() ?? "";

  return (
    !isXmlDocument(document) &&
    (mimeType === "application/pdf" ||
      mimeType.startsWith("image/") ||
      filename.endsWith(".pdf"))
  );
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

function getDocumentState(document: DocumentItem) {
  return getDocumentHumanStatus(document).label;
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

function matchesFilter(document: DocumentItem, filters: Record<string, string>) {
  const data = getData(document);
  const state = getDocumentState(document);
  const provider = document.extraction?.extraction_provider ?? "none";
  const query = filters.q?.toLowerCase().trim();
  const lifecycle = getLifecycleState(document);

  if (filters.lifecycle && filters.lifecycle !== "all" && lifecycle !== filters.lifecycle) {
    return false;
  }

  if (filters.status && filters.status !== "all" && state !== filters.status) {
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

  if (query) {
    const haystack = [
      document.display_name,
      document.original_filename,
      document.document_type,
      document.notes,
      getValue(data, ["emisor_nombre", "supplier_name"], ""),
      getValue(data, ["numero_consecutivo", "document_number"], ""),
      getValue(data, ["clave"], ""),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  }

  return true;
}

function InboxStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "cyan" | "amber" | "emerald";
}) {
  const toneClass = {
    amber: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    cyan: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
    default: "border-white/[0.08] bg-white/[0.04] text-slate-100",
    emerald: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
  }[tone];

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-current/70">{label}</p>
    </div>
  );
}

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const params = (await searchParams) ?? {};
  const filters = {
    documentType: getParam(params, "documentType") ?? "all",
    lifecycle: getParam(params, "lifecycle") ?? "active",
    provider: getParam(params, "provider") ?? "all",
    q: getParam(params, "q") ?? "",
    status: getParam(params, "status") ?? "all",
  };
  const { activeContext, documents } = await listDocumentsByCompany();
  const activeCompany = activeContext.activeCompany;
  const filteredDocuments = documents.filter((document) =>
    matchesFilter(document, filters),
  );
  const activeDocuments = documents.filter(
    (document) => getLifecycleState(document) === "active",
  );
  const pendingReviewCount = activeDocuments.filter(
    (document) => getDocumentState(document) === "Requiere revisión",
  ).length;
  const convertedCount = activeDocuments.filter((document) =>
    ["Convertido a compra", "Convertido a factura"].includes(getDocumentState(document)),
  ).length;
  const ocrPendingCount = activeDocuments.filter(
    (document) => getDocumentState(document) === "Recibido" && isAiProcessableDocument(document),
  ).length;
  const recentActivityCount = activeDocuments.filter((document) => {
    const today = new Date().toISOString().slice(0, 10);
    return document.created_at?.slice(0, 10) === today;
  }).length;

  return (
    <ModuleFrame>
      <section className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_34%),rgba(255,255,255,0.045)] shadow-2xl shadow-cyan-950/20">
        <div className="grid gap-6 p-5 lg:grid-cols-[1.1fr_0.9fr] lg:p-7">
          <div>
            <div className="mb-4 flex justify-end lg:hidden">
              <Link className="om7-btn-ghost px-4 py-2.5" href="/dashboard">
                Volver al dashboard
              </Link>
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-200/75">
              Centro operativo documental
            </p>
            <h1 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight text-white sm:text-3xl lg:text-4xl">
              Inbox financiero para revisar, aprobar y convertir documentos.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Priorice XML, PDFs e imagenes desde una sola bandeja. Abra un
              documento solo cuando necesite revisarlo o convertirlo.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <a
                className="om7-btn-primary px-4 py-3"
                href="#subir-documento"
              >
                Subir documento
              </a>
              <Link
                className="om7-btn-ghost px-4 py-3"
                href="/bandeja"
              >
                Ir a bandeja diaria
              </Link>
            </div>
          </div>

          <div>
            <div className="mb-4 hidden justify-end lg:flex">
              <Link className="om7-btn-ghost px-4 py-2.5" href="/dashboard">
                Volver al dashboard
              </Link>
            </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <InboxStat
              label="pendientes de revision"
              tone="amber"
              value={pendingReviewCount}
            />
            <InboxStat
              label="OCR pendientes"
              tone="cyan"
              value={ocrPendingCount}
            />
            <InboxStat
              label="convertidos"
              tone="emerald"
              value={convertedCount}
            />
            <InboxStat
              label="actividad hoy"
              value={recentActivityCount}
            />
          </div>
          </div>
        </div>
      </section>

      {!activeCompany ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/10 p-5">
          <p className="text-sm font-medium text-amber-100">
            Selecciona una empresa activa
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-100/75">
            Los documentos se guardan para el cliente/empresa activa. Define
            ese contexto antes de subir archivos.
          </p>
          <Link
            className="mt-4 inline-flex rounded-xl border border-amber-200/20 bg-black/15 px-4 py-2 text-sm font-medium text-amber-100 transition hover:bg-black/25"
            href="/empresas"
          >
            Ir a empresas
          </Link>
        </PremiumCard>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-4">
          <PremiumCard className="p-4 sm:p-5">
            <form action="/documentos" className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-300">
                  Buscar documentos
                </span>
                <input
                  className="mt-2 h-14 w-full rounded-2xl border border-white/[0.08] bg-black/20 px-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10"
                  defaultValue={filters.q}
                  name="q"
                  placeholder="Buscar por proveedor, archivo, clave o consecutivo..."
                />
              </label>

              <div className="flex flex-wrap gap-2">
                {quickFilters.map((filter) => (
                  <Link
                    className="om7-chip transition hover:border-cyan-300/25 hover:bg-cyan-300/10 hover:text-cyan-100"
                    href={filter.href}
                    key={filter.href}
                  >
                    {filter.label}
                  </Link>
                ))}
                <Link
                  className="om7-chip bg-black/20 text-slate-500 transition hover:bg-white/[0.05] hover:text-slate-300"
                  href="/documentos"
                >
                  Limpiar
                </Link>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <select
                  className="h-11 rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10"
                  defaultValue={filters.status}
                  name="status"
                >
                  {[
                    "all",
                    "Recibido",
                    "Requiere revisión",
                    "Listo para convertir",
                    "Convertido a compra",
                    "Convertido a factura",
                    "Error / requiere atención",
                  ].map((status) => (
                    <option className="bg-slate-950" key={status} value={status}>
                      {status === "all" ? "Estado: todos" : status}
                    </option>
                  ))}
                </select>
                <select
                  className="h-11 rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10"
                  defaultValue={filters.documentType}
                  name="documentType"
                >
                  {["all", "factura", "compra", "contrato", "estado_cuenta", "otro"].map(
                    (type) => (
                      <option className="bg-slate-950" key={type} value={type}>
                        {type === "all" ? "Tipo: todos" : type}
                      </option>
                    ),
                  )}
                </select>
                <select
                  className="h-11 rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10"
                  defaultValue={filters.provider}
                  name="provider"
                >
                  <option className="bg-slate-950" value="all">
                    Origen: todos
                  </option>
                  <option className="bg-slate-950" value="xml-parser-cr">
                    XML CR
                  </option>
                  <option className="bg-slate-950" value="openai-vision">
                    IA Vision
                  </option>
                  <option className="bg-slate-950" value="manual">
                    Manual
                  </option>
                  <option className="bg-slate-950" value="none">
                    Sin extracción
                  </option>
                </select>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  ["active", "Activos"],
                  ["archived", "Archivados"],
                  ["inactive", "Inactivos"],
                  ["deleted", "Eliminados"],
                  ["all", "Todos"],
                ].map(([value, label]) => (
                  <label
                    className={[
                      "inline-flex cursor-pointer items-center rounded-full border px-3 py-2 text-xs font-semibold transition",
                      filters.lifecycle === value
                        ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
                        : "border-white/[0.08] bg-white/[0.035] text-slate-400 hover:border-white/[0.16] hover:text-slate-200",
                    ].join(" ")}
                    key={value}
                  >
                    <input
                      className="sr-only"
                      defaultChecked={filters.lifecycle === value}
                      name="lifecycle"
                      type="radio"
                      value={value}
                    />
                    {label}
                  </label>
                ))}
              </div>

              <button
                className="om7-btn-secondary px-4"
                type="submit"
              >
                Aplicar filtros
              </button>
            </form>
          </PremiumCard>

          <PremiumCard className="p-4 sm:p-5">
            <DocumentInboxList
              activeCompanyName={activeCompany?.name ?? "Empresa activa"}
              documents={filteredDocuments}
              totalCount={documents.length}
            />
          </PremiumCard>
        </div>

        <aside className="space-y-4">
          <div className="scroll-mt-6" id="subir-documento">
          <PremiumCard className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">
                  Subir documento
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Cargue XML, PDF o imagen sin salir de la bandeja.
                </p>
              </div>
              <span className="om7-chip om7-chip-cyan">Carga</span>
            </div>
              <form action={uploadDocumentAction} className="mt-5 space-y-4">
                <input name="redirectTo" type="hidden" value="/documentos" />
                <input name="relatedType" type="hidden" value="general" />

                <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-200/20 bg-cyan-200/[0.04] px-4 py-6 text-center transition hover:border-cyan-200/35 hover:bg-cyan-200/[0.07]">
                  <span className="text-sm font-medium text-cyan-100">
                    XML, PDF o imagen
                  </span>
                  <span className="mt-2 text-xs leading-5 text-slate-500">
                    XML automatico. PDFs e imagenes con IA Vision.
                  </span>
                  <input
                    accept="application/pdf,image/*,.xml,application/xml,text/xml"
                    className="mt-4 block w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-950"
                    disabled={!activeCompany}
                    name="file"
                    required
                    type="file"
                  />
                </label>

                <select
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                  disabled={!activeCompany}
                  name="documentType"
                >
                  <option className="bg-slate-950" value="factura">
                    Factura
                  </option>
                  <option className="bg-slate-950" value="compra">
                    Compra
                  </option>
                  <option className="bg-slate-950" value="contrato">
                    Contrato
                  </option>
                  <option className="bg-slate-950" value="estado_cuenta">
                    Estado cuenta
                  </option>
                  <option className="bg-slate-950" value="otro">
                    Otro
                  </option>
                </select>

                <button
                  className="om7-btn-primary flex h-11 w-full items-center justify-center px-4 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!activeCompany}
                  type="submit"
                >
                  Subir
                </button>
              </form>
          </PremiumCard>
          </div>

          <PremiumCard className="p-5">
            <p className="text-sm font-semibold text-white">Qué sigue</p>
            <div className="mt-4 space-y-3 text-sm text-slate-400">
              <p>
                <span className="font-semibold text-cyan-100">1.</span> Suba o
                reciba documentos.
              </p>
              <p>
                <span className="font-semibold text-cyan-100">2.</span> Abra el
                workspace del documento.
              </p>
              <p>
                <span className="font-semibold text-cyan-100">3.</span> Revise
                y convierta en compra o factura.
              </p>
            </div>
          </PremiumCard>
        </aside>
      </section>
    </ModuleFrame>
  );
}
