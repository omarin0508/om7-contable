import Link from "next/link";
import {
  createInvoiceFromXmlAction,
  createPurchaseFromXmlAction,
} from "@/app/(platform)/documentos/actions";
import { ExtractionReviewForm } from "@/components/documents/extraction-review-form";
import {
  ExtractionSummary,
  getExtractionReference,
} from "@/components/documents/extraction-summary";
import { StatusBadge } from "@/components/modules/shared";
import { normalizeCurrencyCode } from "@/lib/currency";
import type { DocumentClassificationRecord } from "@/lib/document-classification";
import type { DocumentExtraction } from "@/lib/document-processing";

type DocumentExtractionWorkspaceProps = {
  documentId: string;
  documentName: string;
  documentType: string;
  createdAtLabel: string;
  extraction: DocumentExtraction;
  history: DocumentExtraction[];
  redirectTo: string;
  duplicateCount?: number;
  mimeType?: string | null;
  relatedType?: string | null;
  convertedAt?: string | null;
  convertedRecordId?: string | null;
  convertedType?: "purchase" | "invoice" | null;
  classification?: DocumentClassificationRecord | null;
  signedUrl?: string | null;
};

const workflowSteps = ["Entrada", "Extraido", "Clasificado", "Salida"];

function formatProcessedAt(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function toData(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }

  return value as Record<string, unknown>;
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

function getProviderLabel(provider: string) {
  const labels: Record<string, string> = {
    "xml-parser-cr": "XML Costa Rica",
    "openai-vision": "IA Vision",
    manual: "Manual",
  };

  return labels[provider] ?? provider;
}

function getConfidenceLabel(confidence: number | null) {
  const value = Number(confidence ?? 0);

  if (value >= 0.9 || value >= 90) {
    return "Alta";
  }

  if (value >= 0.65 || value >= 65) {
    return "Media";
  }

  return "Revisar antes de convertir";
}

function getCurrentStepIndex(
  extraction: DocumentExtraction,
  relatedType?: string | null,
  convertedType?: string | null,
) {
  if (convertedType || relatedType === "purchase" || relatedType === "invoice") {
    return 3;
  }

  if (extraction.extraction_status === "reviewed") {
    return 2;
  }

  if (extraction.extraction_status === "processed") {
    return 1;
  }

  return 0;
}

function getStateLabel(
  extraction: DocumentExtraction,
  relatedType?: string | null,
  convertedType?: string | null,
) {
  if (convertedType === "purchase" || relatedType === "purchase") {
    return "Compra creada";
  }

  if (convertedType === "invoice" || relatedType === "invoice") {
    return "Factura creada";
  }

  if (extraction.extraction_status === "reviewed") {
    return "Revisado";
  }

  if (extraction.extraction_status === "processed") {
    return "Listo para revisar";
  }

  if (extraction.extraction_status === "error") {
    return "Error";
  }

  return "Procesado";
}

function getNextActionCopy(
  extraction: DocumentExtraction,
  relatedType?: string | null,
  convertedType?: string | null,
) {
  if (convertedType === "purchase" || relatedType === "purchase") {
    return {
      detail: "Este documento ya fue convertido en una compra.",
      title: "Compra creada",
      tone: "emerald",
    };
  }

  if (convertedType === "invoice" || relatedType === "invoice") {
    return {
      detail: "Este documento ya fue convertido en una factura.",
      title: "Factura creada",
      tone: "emerald",
    };
  }

  if (extraction.extraction_status === "reviewed") {
    return {
      detail: "Los datos ya fueron aprobados. Dele salida como compra o venta.",
      title: "Listo para salida",
      tone: "cyan",
    };
  }

  if (extraction.extraction_status === "error") {
    return {
      detail: "Revise el error o vuelva a procesar el documento si aplica.",
      title: "Atención requerida",
      tone: "rose",
    };
  }

  return {
    detail: "Confirme proveedor, fecha, lineas y totales antes de dar salida.",
    title: "Clasificacion requerida",
    tone: "amber",
  };
}

function DocumentPreview({
  documentId,
  documentName,
  mimeType,
  signedUrl,
}: {
  documentId: string;
  documentName: string;
  mimeType?: string | null;
  signedUrl?: string | null;
}) {
  const isXml =
    mimeType?.includes("xml") || documentName.toLowerCase().endsWith(".xml");
  const isPdf =
    mimeType === "application/pdf" || documentName.toLowerCase().endsWith(".pdf");
  const isImage = mimeType?.startsWith("image/") ?? false;

  if (isXml) {
    return (
      <div className="grid min-h-64 place-items-center rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.035] p-5 text-center">
        <div>
          <p className="text-sm font-semibold text-white">Vista OM7 del XML</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            El XML tecnico se conserva para auditoria, pero la operacion se
            realiza desde datos interpretados.
          </p>
          <Link
            className="om7-btn-secondary mt-4 px-4 py-2 text-xs"
            href={`/visor-documento/${documentId}`}
          >
            Abrir visor XML
          </Link>
        </div>
      </div>
    );
  }

  if (isPdf && signedUrl) {
    return (
      <iframe
        className="h-80 w-full rounded-2xl border border-white/[0.08] bg-black/20"
        src={signedUrl}
        title={documentName}
      />
    );
  }

  if (isImage && signedUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={documentName}
        className="max-h-80 w-full rounded-2xl border border-white/[0.08] object-contain"
        src={signedUrl}
      />
    );
  }

  return (
    <div className="grid min-h-64 place-items-center rounded-2xl border border-white/[0.08] bg-black/20 p-5 text-center">
      <div>
        <p className="text-sm font-semibold text-white">Preview no disponible</p>
        <p className="mt-2 text-xs text-slate-500">
          El archivo se mantiene privado en Supabase Storage.
        </p>
      </div>
    </div>
  );
}

export function DocumentExtractionWorkspace({
  documentId,
  documentName,
  documentType,
  createdAtLabel,
  extraction,
  history,
  redirectTo,
  duplicateCount = 0,
  mimeType,
  relatedType,
  convertedAt,
  convertedRecordId,
  convertedType,
  classification,
  signedUrl,
}: DocumentExtractionWorkspaceProps) {
  const data = toData(extraction.extracted_data);
  const isReviewed = extraction.extraction_status === "reviewed";
  const pendingReview = !isReviewed;
  const isConverted =
    Boolean(convertedType && convertedRecordId) ||
    relatedType === "purchase" ||
    relatedType === "invoice";
  const convertedLabel =
    convertedType === "invoice" || relatedType === "invoice"
      ? "factura"
      : "compra";
  const currentStep = getCurrentStepIndex(extraction, relatedType, convertedType);
  const stateLabel = getStateLabel(extraction, relatedType, convertedType);
  const nextAction = getNextActionCopy(extraction, relatedType, convertedType);
  const nextActionClass = {
    amber: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    cyan: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
    emerald: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
    rose: "border-rose-300/20 bg-rose-300/10 text-rose-100",
  }[nextAction.tone];
  const classificationCanApply =
    classification?.status === "accepted" ||
    classification?.status === "edited" ||
    classification?.status === "suggested";
  const classificationIsReviewed =
    classification?.status === "accepted" || classification?.status === "edited";

  return (
    <article className="px-5 py-5" id={`extraccion-${extraction.id}`}>
      <div className="rounded-3xl border border-white/[0.08] bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_32%),rgba(255,255,255,0.035)] p-4 shadow-2xl shadow-black/15 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/70">
              Documento en Bandeja
            </p>
            <p className="mt-2 break-words text-lg font-semibold text-white">
              {documentName}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {documentType} · {createdAtLabel}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge>{stateLabel}</StatusBadge>
            <span className="om7-chip om7-chip-cyan">
              {getProviderLabel(extraction.extraction_provider)}
            </span>
            <span className="om7-chip">
              Confianza {getConfidenceLabel(extraction.confidence)}
            </span>
          </div>
        </div>

        <div className={`mt-5 rounded-3xl border p-4 ${nextActionClass}`}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xl font-semibold tracking-tight">
                {nextAction.title}
              </p>
              <p className="mt-1 text-sm leading-6 text-current/75">
                {nextAction.detail}
              </p>
            </div>
            <span className="w-fit rounded-full border border-current/20 bg-black/15 px-3 py-1 text-xs font-semibold text-current">
              {stateLabel}
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          {workflowSteps.map((step, index) => (
            <div
              className={[
                "rounded-2xl border px-3 py-3 text-center text-xs font-semibold transition",
                index <= currentStep
                  ? "border-cyan-300/30 bg-cyan-300/12 text-cyan-50 shadow-lg shadow-cyan-950/20"
                  : "border-white/[0.08] bg-black/20 text-slate-500",
              ].join(" ")}
              key={step}
            >
              {step}
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Proveedor / emisor", getValue(data, ["emisor_nombre", "supplier_name"])],
                ["Receptor", getValue(data, ["receptor_nombre", "customer_name"])],
                ["Fecha", getValue(data, ["fecha_emision", "date"])],
                ["Consecutivo", getValue(data, ["numero_consecutivo", "document_number"])],
                ["Tipo recibido", getValue(data, ["document_kind"], documentType)],
                ["Total", getMoney(data)],
              ].map(([label, value]) => (
                <div
                  className="rounded-2xl border border-white/[0.08] bg-black/15 p-3"
                  key={label}
                >
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-1 break-words text-sm font-semibold text-slate-100">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {duplicateCount > 1 ? (
              <p className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
                Posible duplicado: ya existe otra extraccion con la misma clave
                o consecutivo.
              </p>
            ) : null}

            <div className="rounded-3xl border border-white/[0.08] bg-black/20 p-4">
              <p className="text-sm font-semibold text-white">Salida desde Bandeja</p>
              {isConverted ? (
                <div className="mt-4 space-y-3">
                  <p className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs leading-5 text-emerald-100">
                    Este documento ya fue convertido en una {convertedLabel}
                    {convertedAt ? ` el ${formatProcessedAt(convertedAt)}` : ""}.
                  </p>
                  <Link
                    className="om7-btn-secondary h-14 px-4 text-sm"
                    href={convertedLabel === "compra" ? "/compras" : "/facturas"}
                  >
                    Ver {convertedLabel}
                  </Link>
                </div>
              ) : pendingReview ? (
                <details className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.04]">
                  <summary className="om7-btn-primary cursor-pointer px-4 py-4">
                    Revisar y aprobar datos
                  </summary>
                  <div className="max-h-[75vh] overflow-auto border-t border-cyan-300/10 p-4">
                    <ExtractionReviewForm
                      extractedData={extraction.extracted_data}
                      extractionId={extraction.id}
                      redirectTo={redirectTo}
                    />
                  </div>
                </details>
              ) : (
                <div className="mt-4 space-y-3">
                  {classificationCanApply ? (
                    <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-xs leading-5 text-emerald-100">
                      <p className="font-semibold">
                        {classificationIsReviewed
                          ? "Se aplicara la sugerencia aceptada"
                          : "OM7 usara esta sugerencia como apoyo"}
                      </p>
                      <p className="mt-1 text-emerald-100/75">
                        {classification.suggested_category ?? "Sin categoria"} /{" "}
                        {classification.suggested_account ?? "Sin cuenta"} ·{" "}
                        Confianza {getConfidenceLabel(classification.confidence_score)}
                      </p>
                    </div>
                  ) : (
                    <p className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
                      No existe clasificacion aceptada. El registro se creara
                      sin sugerencias.
                    </p>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <form action={createPurchaseFromXmlAction}>
                      <input
                        name="extractionId"
                        type="hidden"
                        value={extraction.id}
                      />
                      <button
                        className="om7-btn-secondary h-14 w-full px-4 text-sm"
                        type="submit"
                      >
                        Enviar a Compras
                      </button>
                    </form>
                    <form action={createInvoiceFromXmlAction}>
                      <input
                        name="extractionId"
                        type="hidden"
                        value={extraction.id}
                      />
                      <button
                        className="om7-btn-secondary h-14 w-full px-4 text-sm"
                        type="submit"
                      >
                        Enviar a Facturas
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-white/[0.08] bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">
                  Preview documento
                </p>
                {signedUrl ? (
                  <a
                    className="om7-btn-ghost px-3 py-1.5 text-xs"
                    href={signedUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Abrir original
                  </a>
                ) : null}
              </div>
              <div className="mt-4">
                <DocumentPreview
                  documentId={documentId}
                  documentName={documentName}
                  mimeType={mimeType}
                  signedUrl={signedUrl}
                />
              </div>
            </div>
          </aside>
        </div>

        {extraction.error_message ? (
          <p className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs leading-5 text-rose-100">
            {extraction.error_message}
          </p>
        ) : null}

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <details className="rounded-2xl border border-white/[0.08] bg-black/15 p-4">
            <summary className="cursor-pointer text-sm font-medium text-slate-200">
              Ver detalle del documento
            </summary>
            <div className="mt-4">
              <ExtractionSummary
                extractedData={extraction.extracted_data}
                showTechnicalJson={false}
              />
            </div>
          </details>

          <details className="rounded-2xl border border-white/[0.08] bg-black/15 p-4">
            <summary className="cursor-pointer text-sm font-medium text-slate-200">
              Ver datos tecnicos
            </summary>
            <pre className="mt-4 max-h-56 overflow-auto rounded-xl border border-white/[0.08] bg-black/25 p-3 text-xs leading-5 text-slate-300">
              {JSON.stringify(extraction.extracted_data ?? {}, null, 2)}
            </pre>
            <pre className="mt-3 max-h-40 overflow-auto rounded-xl border border-white/[0.08] bg-black/25 p-3 text-xs leading-5 text-slate-300">
              {extraction.raw_text || "Sin texto extraido."}
            </pre>
          </details>
        </div>

        {history.length > 1 ? (
          <details className="mt-4 rounded-2xl border border-white/[0.08] bg-black/15 p-4">
            <summary className="cursor-pointer text-sm font-medium text-slate-200">
              Historial de extracciones
            </summary>
            <div className="mt-4 grid gap-3">
              {history.map((item) => (
                <div
                  className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3"
                  key={item.id}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge>{item.extraction_status}</StatusBadge>
                    <span className="rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 text-xs text-slate-400">
                      {getProviderLabel(item.extraction_provider)}
                    </span>
                    <span className="rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 text-xs text-slate-400">
                      Confianza {getConfidenceLabel(item.confidence)}
                    </span>
                    <span className="rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 text-xs text-slate-400">
                      {formatProcessedAt(item.processed_at ?? item.created_at)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Referencia: {getExtractionReference(item.extracted_data) || "N/D"}
                  </p>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </article>
  );
}
