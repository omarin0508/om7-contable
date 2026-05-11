import Link from "next/link";
import { normalizeCurrencyCode } from "@/lib/currency";
import type { DocumentExtraction } from "@/lib/document-processing";
import type { DocumentRecord } from "@/lib/storage";

type InboxDocument = DocumentRecord & {
  signedUrl: string | null;
  extraction?: DocumentExtraction | null;
};

type DocumentInboxListProps = {
  activeCompanyName: string;
  documents: InboxDocument[];
  totalCount: number;
};

const providerLabels: Record<string, string> = {
  "xml-parser-cr": "XML CR",
  "openai-vision": "IA Vision",
  manual: "Manual",
  none: "Sin extraccion",
};

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

function formatDate(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getData(document: InboxDocument) {
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

function getMoney(data: Record<string, unknown>) {
  const amount = Number(data.total ?? 0);

  if (!Number.isFinite(amount) || amount <= 0) {
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

function getConfidenceLabel(confidence: number | null | undefined) {
  const value = Number(confidence ?? 0);

  if (value >= 0.9 || value >= 90) {
    return "Alta";
  }

  if (value >= 0.65 || value >= 65) {
    return "Media";
  }

  return "Revisar";
}

function getDocumentState(document: InboxDocument) {
  const extraction = document.extraction;

  if (document.converted_type === "purchase" || document.related_type === "purchase") {
    return "Compra creada";
  }

  if (document.converted_type === "invoice" || document.related_type === "invoice") {
    return "Factura creada";
  }

  if (document.processing_status === "error" || extraction?.extraction_status === "error") {
    return "Error";
  }

  if (extraction?.extraction_status === "reviewed") {
    return "Revisado";
  }

  if (extraction?.extraction_status === "processed") {
    return "Procesado";
  }

  if (document.processing_status === "uploaded" || document.processing_status === "pending") {
    return "Subido";
  }

  return document.processing_status;
}

function getDocumentInitials(document: InboxDocument) {
  if (isXmlDocument(document)) {
    return "XML";
  }

  if (document.mime_type === "application/pdf") {
    return "PDF";
  }

  if (document.mime_type?.startsWith("image/")) {
    return "IMG";
  }

  return "DOC";
}

function getDocumentTitle(document: InboxDocument) {
  return document.display_name || document.original_filename || "Documento";
}

function getLifecycleLabel(document: InboxDocument) {
  if (document.deleted_at) {
    return "Eliminado";
  }

  if (document.inactive_at) {
    return "Inactivo";
  }

  if (document.archived_at) {
    return "Archivado";
  }

  return "Activo";
}

function getPrimaryAction(document: InboxDocument) {
  if (document.converted_type === "purchase" || document.related_type === "purchase") {
    return {
      href: "/compras",
      label: "Ver compra",
    };
  }

  if (document.converted_type === "invoice" || document.related_type === "invoice") {
    return {
      href: "/facturas",
      label: "Ver factura",
    };
  }

  return {
    href: `/documentos/${document.id}`,
    label: "Abrir documento",
  };
}

export function DocumentInboxList({
  activeCompanyName,
  documents,
  totalCount,
}: DocumentInboxListProps) {
  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-base font-semibold text-white">
            Bandeja documental
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Cada documento abre un workspace dedicado. La lista se mantiene
            compacta para operar rapido.
          </p>
        </div>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-slate-400">
          {documents.length} de {totalCount}
        </span>
      </div>

      <div className="mt-5 max-h-[72vh] overflow-y-auto overscroll-contain pr-1">
        <div className="grid gap-3">
        {documents.length > 0 ? (
          documents.map((document) => {
            const data = getData(document);
            const state = getDocumentState(document);
            const provider = document.extraction?.extraction_provider ?? "none";
            const lifecycleLabel = getLifecycleLabel(document);
            const primaryAction = getPrimaryAction(document);

            return (
              <article
                className="group relative isolate rounded-3xl border border-white/[0.08] bg-white/[0.025] p-4 shadow-lg shadow-black/10 transition hover:border-cyan-300/25 hover:bg-white/[0.045] hover:shadow-cyan-950/20"
                key={document.id}
              >
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(250px,0.58fr)_minmax(150px,auto)] lg:items-center">
                  <Link className="block min-w-0" href={`/documentos/${document.id}`}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="grid h-9 w-10 place-items-center rounded-xl border border-cyan-300/15 bg-cyan-300/10 text-[11px] font-bold text-cyan-100">
                        {getDocumentInitials(document)}
                      </span>
                      <span className="om7-chip">{state}</span>
                      <span className="om7-chip om7-chip-cyan">
                        {providerLabels[provider] ?? provider}
                      </span>
                      <span className="om7-chip text-slate-400">
                        Confianza {getConfidenceLabel(document.extraction?.confidence)}
                      </span>
                      <span className="om7-chip text-slate-400">
                        {lifecycleLabel}
                      </span>
                    </div>
                    <p className="mt-3 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold text-white sm:whitespace-normal sm:break-words sm:[display:-webkit-box] sm:[-webkit-line-clamp:2] sm:[-webkit-box-orient:vertical]">
                      {getDocumentTitle(document)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {activeCompanyName} · {document.document_type} ·{" "}
                      {formatBytes(document.size_bytes)} · {formatDate(document.created_at)}
                    </p>
                  </Link>

                  <div className="grid min-w-0 gap-3 sm:grid-cols-3">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">Proveedor</p>
                      <p className="mt-1 truncate text-sm font-medium text-slate-100">
                        {getValue(data, ["emisor_nombre", "supplier_name"])}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">Fecha</p>
                      <p className="mt-1 truncate text-sm font-medium text-slate-100">
                        {getValue(data, ["fecha_emision", "date"], "Sin fecha")}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">Total</p>
                      <p className="mt-1 truncate text-sm font-semibold text-cyan-50">
                        {getMoney(data)}
                      </p>
                    </div>
                  </div>

                  <div className="flex min-w-0 items-center justify-end gap-2">
                    <Link
                      className="om7-btn-primary h-10 min-w-0 flex-1 px-3 text-xs sm:flex-none lg:min-w-28"
                      href={primaryAction.href}
                    >
                      {primaryAction.label}
                    </Link>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <p className="rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.025] px-5 py-10 text-center text-sm text-slate-500">
            No hay documentos para los filtros seleccionados.
          </p>
        )}
        </div>
      </div>
    </>
  );
}
