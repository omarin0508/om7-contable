import Link from "next/link";
import {
  processDocumentAction,
  processDocumentWithVisionAction,
  uploadDocumentAction,
  createInvoiceFromXmlAction,
  createPurchaseFromXmlAction,
} from "@/app/(platform)/documentos/actions";
import {
  markDocumentRejectedAction,
  markDocumentReviewedAction,
} from "@/app/(platform)/bandeja/actions";
import {
  BackLink,
  ModuleFrame,
  StatusBadge,
} from "@/components/modules/shared";
import { PremiumCard } from "@/components/ui/premium-card";
import {
  formatConfidence as formatDocumentConfidence,
  getDocumentHumanStatus,
} from "@/lib/document-ui";
import {
  listClientUploadReviewDocuments,
  type ReviewDocument,
} from "@/lib/document-review";
import { normalizeCurrencyCode } from "@/lib/currency";

type BandejaPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type FlowKey =
  | "received"
  | "processed"
  | "human_review"
  | "observed"
  | "approved"
  | "converted";

type ActionFilter = "all" | "xml" | "pdf_image" | "gmail" | "manual";

const flowLabels: Record<FlowKey, string> = {
  approved: "Aprobado",
  converted: "Convertido",
  human_review: "Revision humana",
  observed: "Observado",
  processed: "Procesado",
  received: "Recibido",
};

const statusFilters: Array<{ key: "all" | "pending" | "observed" | "ready"; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "pending", label: "Pendientes" },
  { key: "observed", label: "Observados" },
  { key: "ready", label: "Listos" },
];

const actionFilters: Array<{ key: ActionFilter; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "xml", label: "XML" },
  { key: "pdf_image", label: "PDF/imagen" },
  { key: "gmail", label: "Desde Gmail" },
  { key: "manual", label: "Subida manual" },
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

function getData(document: ReviewDocument) {
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
    return "Sin monto";
  }

  return `${normalizeCurrencyCode(data.moneda ?? data.currency)} ${amount.toLocaleString(
    "es-CR",
    {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    },
  )}`;
}

function getDocumentKind(document: ReviewDocument) {
  if (isXmlDocument(document)) {
    return "XML";
  }

  if (document.extraction?.extraction_provider === "openai-vision") {
    return "OCR";
  }

  if (document.mime_type === "application/pdf") {
    return "PDF";
  }

  if (document.mime_type?.startsWith("image/")) {
    return "Imagen";
  }

  return "Documento";
}

function getSourceLabel(document: ReviewDocument) {
  const metadata = document.metadata ?? {};
  const source = String(metadata.source ?? metadata.upload_source ?? "").toLowerCase();

  if (source.includes("gmail") || document.storage_path.includes("/gmail/")) {
    return "Gmail";
  }

  if (document.extraction?.extraction_provider === "xml-parser-cr") {
    return "XML";
  }

  if (document.extraction?.extraction_provider === "openai-vision") {
    return "OCR";
  }

  return "Manual";
}

function getFlowState(document: ReviewDocument): FlowKey {
  if (document.converted_type || document.converted_at) {
    return "converted";
  }

  if (
    document.processing_status === "error" ||
    document.processing_status === "failed" ||
    document.review_status === "rejected" ||
    document.review_status === "observed" ||
    document.extraction?.extraction_status === "error"
  ) {
    return "observed";
  }

  if (document.review_status === "reviewed" || document.extraction?.extraction_status === "reviewed") {
    return "approved";
  }

  if (
    document.extraction?.extraction_status === "processed" ||
    document.processing_status === "completed"
  ) {
    return "human_review";
  }

  if (document.extraction) {
    return "processed";
  }

  return "received";
}

function getStatusLabel(document: ReviewDocument) {
  if (document.converted_type === "purchase") {
    return "Compra creada";
  }

  if (document.converted_type === "invoice") {
    return "Venta creada";
  }

  return flowLabels[getFlowState(document)] ?? getDocumentHumanStatus(document).label;
}

function getClassificationLabel(document: ReviewDocument) {
  const classification = document.classification;

  if (!classification) {
    return "Sin clasificacion";
  }

  const flowLabel =
    classification.flow_type === "purchase"
      ? "Compra"
      : classification.flow_type === "sale" || classification.flow_type === "income"
        ? "Venta"
        : "Otro";

  return `${flowLabel} / ${
    classification.suggested_category ||
    classification.suggested_account ||
    "sin categoria"
  }`;
}

function getCounterpartyLabel(document: ReviewDocument) {
  return document.counterpartyMatch?.name || "Sin contraparte";
}

function getRecommendedStep(document: ReviewDocument) {
  const flow = getFlowState(document);

  if (flow === "received") {
    return isXmlDocument(document)
      ? "Procesar XML para extraer datos fiscales."
      : "Procesar OCR/IA para extraer datos antes de revisar.";
  }

  if (flow === "processed" || flow === "human_review") {
    if (!document.counterpartyMatch) {
      return "Asociar contraparte para continuar.";
    }

    if (!document.classification) {
      return "Clasificar documento antes de aprobar.";
    }

    return "Revisar extraccion antes de aprobar.";
  }

  if (flow === "observed") {
    return "Resolver la observacion y devolver a revision.";
  }

  if (flow === "approved") {
    const suggested = document.classification?.flow_type;
    return suggested === "sale" || suggested === "income"
      ? "Documento listo para crear venta."
      : "Documento listo para crear compra.";
  }

  if (document.convertedRecord?.review_status === "approved") {
    return "Documento convertido y aprobado. Revisar asiento si aplica.";
  }

  return "Registro creado. Falta revision/contabilizacion en el modulo destino.";
}

function isOperationalDocument(document: ReviewDocument) {
  return getFlowState(document) !== "converted";
}

function matchesQuery(document: ReviewDocument, query: string) {
  if (!query) {
    return true;
  }

  const data = getData(document);
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

  return haystack.includes(query.toLowerCase().trim());
}

function matchesActionFilter(document: ReviewDocument, filter: ActionFilter) {
  if (filter === "all") {
    return true;
  }

  if (filter === "xml") {
    return isXmlDocument(document);
  }

  if (filter === "pdf_image") {
    return isPdfOrImageDocument(document);
  }

  if (filter === "gmail") {
    return getSourceLabel(document) === "Gmail";
  }

  return getSourceLabel(document) === "Manual";
}

function matchesFilters({
  actionFilter,
  date,
  document,
  query,
  status,
}: {
  actionFilter: ActionFilter;
  date?: string;
  document: ReviewDocument;
  query: string;
  status: string;
}) {
  const flow = getFlowState(document);
  const statusMatches =
    status === "all" ||
    (status === "pending" && ["received", "processed", "human_review"].includes(flow)) ||
    (status === "observed" && flow === "observed") ||
    (status === "ready" && flow === "approved");
  const data = getData(document);
  const documentDate =
    getValue(data, ["fecha_emision", "date"], document.created_at ?? "").slice(0, 10);
  const dateMatches = !date || documentDate === date;

  return (
    statusMatches &&
    dateMatches &&
    matchesActionFilter(document, actionFilter) &&
    matchesQuery(document, query)
  );
}

function buildFilterHref({
  action,
  date,
  doc,
  q,
  status,
}: {
  action: string;
  date?: string;
  doc?: string;
  q?: string;
  status: string;
}) {
  const params = new URLSearchParams();

  if (status !== "all") {
    params.set("status", status);
  }

  if (action !== "all") {
    params.set("action", action);
  }

  if (q) {
    params.set("q", q);
  }

  if (date) {
    params.set("date", date);
  }

  if (doc) {
    params.set("doc", doc);
  }

  const query = params.toString();

  return `/bandeja${query ? `?${query}` : ""}`;
}

function OperationalCounter({
  label,
  tone = "muted",
  value,
}: {
  label: string;
  tone?: "critical" | "primary" | "success" | "muted";
  value: number;
}) {
  const toneClass = {
    critical:
      "border-rose-300/22 bg-rose-300/[0.055] text-rose-50",
    muted:
      "border-white/[0.08] bg-white/[0.035] text-slate-200",
    primary:
      "border-cyan-300/22 bg-cyan-300/[0.055] text-cyan-50",
    success:
      "border-emerald-300/20 bg-emerald-300/[0.05] text-emerald-50",
  }[tone];

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 ${toneClass}`}>
      <span className="text-sm font-semibold leading-none">
        {value}
      </span>
      <span className="text-xs font-medium text-current/70">{label}</span>
    </div>
  );
}

function UploadPanel({ disabled }: { disabled: boolean }) {
  return (
    <PremiumCard className="p-4">
      <p className="text-sm font-semibold text-white">Ingresar documento</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Entra como tarea activa de bandeja.
      </p>
      <form action={uploadDocumentAction} className="mt-4 space-y-3">
        <input name="redirectTo" type="hidden" value="/bandeja" />
        <input name="relatedType" type="hidden" value="client_upload" />
        <input
          accept="application/pdf,image/*,.xml,application/xml,text/xml"
          className="block w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-950 disabled:opacity-50"
          disabled={disabled}
          name="file"
          required
          type="file"
        />
        <select
          className="h-10 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none transition focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
          disabled={disabled}
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
          className="om7-btn-secondary flex h-10 w-full items-center justify-center px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          type="submit"
        >
          Subir a bandeja
        </button>
      </form>
    </PremiumCard>
  );
}

function DocumentRow({
  active,
  actionFilter,
  date,
  document,
  q,
  status,
}: {
  active: boolean;
  actionFilter: ActionFilter;
  date?: string;
  document: ReviewDocument;
  q: string;
  status: string;
}) {
  const data = getData(document);
  const confidence =
    document.classification?.confidence_score ?? document.extraction?.confidence ?? null;

  return (
    <Link
      className={[
        "block rounded-xl border px-3 py-2.5 transition",
        active
          ? "border-cyan-300/34 bg-cyan-300/[0.07] shadow-xl shadow-cyan-950/20"
          : "border-white/[0.08] bg-white/[0.026] hover:border-cyan-300/22 hover:bg-white/[0.045]",
      ].join(" ")}
      href={buildFilterHref({
        action: actionFilter,
        date,
        doc: document.id,
        q,
        status,
      })}
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.7fr)_120px_130px_170px] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge>{getStatusLabel(document)}</StatusBadge>
            <span className="om7-chip text-slate-400">{getDocumentKind(document)}</span>
            <span className="om7-chip om7-chip-cyan">{getSourceLabel(document)}</span>
          </div>
          <p className="mt-2 truncate text-sm font-semibold text-white">
            {getValue(data, ["emisor_nombre", "supplier_name"], document.display_name || document.original_filename || "Documento")}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">
            {getValue(data, ["numero_consecutivo", "document_number", "clave"], document.original_filename || "Sin consecutivo")}
          </p>
        </div>
        <span className="text-xs text-slate-400">
          {getValue(data, ["fecha_emision", "date"], formatDate(document.created_at))}
        </span>
        <span className="text-sm font-semibold text-slate-100">{getMoney(data)}</span>
        <span className="text-xs text-slate-500">
          {formatDocumentConfidence(confidence)}
        </span>
      </div>
    </Link>
  );
}

function StageActions({ document }: { document: ReviewDocument }) {
  const flow = getFlowState(document);
  const extractionId = document.extraction?.id ?? "";
  const returnToInbox = "/bandeja";

  if (flow === "converted") {
    const destination =
      document.converted_type === "purchase"
        ? { href: "/compras", label: "Ver compra creada" }
        : { href: "/facturas", label: "Ver venta creada" };

    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <Link className="om7-btn-primary justify-center px-4 py-2.5" href={destination.href}>
          {destination.label}
        </Link>
        <Link className="om7-btn-secondary justify-center px-4 py-2.5" href={`/documentos/${document.id}`}>
          Ver trazabilidad
        </Link>
      </div>
    );
  }

  if (flow === "approved") {
    return (
      <div className="grid gap-2">
        {extractionId ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <form action={createPurchaseFromXmlAction}>
              <input name="extractionId" type="hidden" value={extractionId} />
              <input name="successRedirectTo" type="hidden" value={returnToInbox} />
              <button className="om7-btn-primary h-11 w-full px-4" type="submit">
                Crear compra
              </button>
            </form>
            <form action={createInvoiceFromXmlAction}>
              <input name="extractionId" type="hidden" value={extractionId} />
              <input name="successRedirectTo" type="hidden" value={returnToInbox} />
              <button className="om7-btn-secondary h-11 w-full px-4" type="submit">
                Crear venta
              </button>
            </form>
          </div>
        ) : null}
        <Link className="om7-btn-ghost justify-center px-4 py-2.5" href={`/documentos/${document.id}/distribucion`}>
          Crear asiento / E7 Mind
        </Link>
      </div>
    );
  }

  if (flow === "human_review" || flow === "processed") {
    return (
      <div className="grid gap-2">
        <Link className="om7-btn-primary justify-center px-4 py-2.5" href={`/documentos/${document.id}`}>
          Revisar extraccion
        </Link>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link className="om7-btn-secondary justify-center px-4 py-2.5" href={`/documentos/${document.id}#contraparte`}>
            Asociar contraparte
          </Link>
          <Link className="om7-btn-secondary justify-center px-4 py-2.5" href={`/documentos/${document.id}#clasificacion`}>
            Clasificar documento
          </Link>
        </div>
        <form action={markDocumentReviewedAction}>
          <input name="documentId" type="hidden" value={document.id} />
          <input name="reviewNotes" type="hidden" value="Aprobado desde centro documental." />
          <button className="om7-btn-primary h-11 w-full px-4" type="submit">
            Aprobar documento
          </button>
        </form>
        <form action={markDocumentRejectedAction}>
          <input name="documentId" type="hidden" value={document.id} />
          <input name="reviewNotes" type="hidden" value="Observado desde centro documental." />
          <button className="om7-btn-ghost h-11 w-full px-4" type="submit">
            Marcar observado
          </button>
        </form>
      </div>
    );
  }

  if (flow === "observed") {
    return (
      <div className="grid gap-2">
        <Link className="om7-btn-primary justify-center px-4 py-2.5" href={`/documentos/${document.id}`}>
          Resolver observacion
        </Link>
        <form action={markDocumentReviewedAction}>
          <input name="documentId" type="hidden" value={document.id} />
          <input name="reviewNotes" type="hidden" value="Observacion corregida desde centro documental." />
          <button className="om7-btn-secondary h-11 w-full px-4" type="submit">
            Devolver a revision
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {isXmlDocument(document) ? (
        <form action={processDocumentAction}>
          <input name="redirectTo" type="hidden" value={returnToInbox} />
          <input name="documentId" type="hidden" value={document.id} />
          <button className="om7-btn-primary h-11 w-full px-4" type="submit">
            Procesar XML
          </button>
        </form>
      ) : isAiProcessableDocument(document) ? (
        <form action={processDocumentWithVisionAction}>
          <input name="redirectTo" type="hidden" value={returnToInbox} />
          <input name="documentId" type="hidden" value={document.id} />
          <button className="om7-btn-primary h-11 w-full px-4" type="submit">
            Procesar OCR / IA
          </button>
        </form>
      ) : (
        <Link className="om7-btn-primary justify-center px-4 py-2.5" href={`/documentos/${document.id}`}>
          Revisar documento
        </Link>
      )}
      <form action={markDocumentRejectedAction}>
        <input name="documentId" type="hidden" value={document.id} />
        <input name="reviewNotes" type="hidden" value="Observado desde centro documental." />
        <button className="om7-btn-ghost h-11 w-full px-4" type="submit">
          Marcar observado
        </button>
      </form>
    </div>
  );
}

function DocumentPreview({ document }: { document: ReviewDocument }) {
  if (!document.signedUrl) {
    return (
      <div className="grid min-h-[360px] place-items-center rounded-2xl border border-dashed border-white/[0.12] bg-black/20 p-8 text-center">
        <div>
          <p className="text-sm font-semibold text-white">Preview no disponible</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            El flujo puede continuar con la extraccion, clasificacion y
            trazabilidad.
          </p>
        </div>
      </div>
    );
  }

  if (document.mime_type?.startsWith("image/")) {
    return (
      <img
        alt={document.display_name || document.original_filename || "Documento"}
        className="max-h-[70vh] w-full rounded-2xl border border-white/[0.08] object-contain"
        src={document.signedUrl}
      />
    );
  }

  return (
    <iframe
      className="h-[70vh] w-full rounded-2xl border border-white/[0.08] bg-black/30"
      src={document.signedUrl}
      title={document.display_name || document.original_filename || "Documento"}
    />
  );
}

function DocumentWorkspace({
  backHref,
  document,
}: {
  backHref: string;
  document: ReviewDocument;
}) {
  const data = getData(document);
  const confidence =
    document.classification?.confidence_score ?? document.extraction?.confidence ?? null;
  const iva = getNumberValue(data, ["impuesto", "tax"]);
  const lineItems = Array.isArray(data.line_items)
    ? (data.line_items as Array<Record<string, unknown>>)
    : [];

  return (
    <section className="space-y-5">
      <PremiumCard className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <Link className="om7-btn-ghost mb-4 inline-flex px-3 py-2 text-sm" href={backHref}>
              &lt;- Volver a bandeja
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge>{getStatusLabel(document)}</StatusBadge>
              <span className="om7-chip text-slate-400">{getDocumentKind(document)}</span>
              <span className="om7-chip om7-chip-cyan">{getSourceLabel(document)}</span>
              <span className="om7-chip text-slate-400">
                Confianza {formatDocumentConfidence(confidence)}
              </span>
              {document.converted_type ? (
                <span className="om7-chip om7-chip-emerald">Convertido</span>
              ) : null}
            </div>
            <h2 className="mt-4 break-words text-2xl font-semibold tracking-tight text-white">
              {getValue(
                data,
                ["emisor_nombre", "supplier_name"],
                document.display_name || document.original_filename || "Documento",
              )}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {document.display_name || document.original_filename || "Sin nombre"} ·{" "}
              recibido {formatDate(document.created_at)}
            </p>
          </div>
          <div className="w-full rounded-2xl border border-cyan-300/18 bg-cyan-300/[0.055] p-4 lg:max-w-md">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/80">
              Siguiente paso recomendado
            </p>
            <p className="mt-2 text-sm leading-6 text-cyan-50">
              {getRecommendedStep(document)}
            </p>
          </div>
        </div>
      </PremiumCard>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="space-y-5">
          <PremiumCard className="p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-base font-semibold text-white">Preview documento</p>
              {document.signedUrl ? (
                <a className="om7-btn-ghost px-3 py-2 text-xs" href={document.signedUrl}>
                  Ver XML/PDF
                </a>
              ) : null}
            </div>
            <DocumentPreview document={document} />
          </PremiumCard>

          <PremiumCard className="p-4 sm:p-5">
            <p className="text-base font-semibold text-white">
              Extraccion IA / XML
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                ["Emisor", getValue(data, ["emisor_nombre", "supplier_name"])],
                ["Receptor", getValue(data, ["receptor_nombre", "customer_name"])],
                ["Clave", getValue(data, ["clave"])],
                ["Consecutivo", getValue(data, ["numero_consecutivo", "document_number"])],
                ["Fecha", getValue(data, ["fecha_emision", "date"])],
                ["Moneda", normalizeCurrencyCode(data.moneda ?? data.currency)],
                ["IVA", iva > 0 ? iva.toLocaleString("es-CR") : "Sin IVA"],
                ["Total", getMoney(data)],
              ].map(([label, value]) => (
                <div className="rounded-xl border border-white/[0.07] bg-black/15 p-3" key={label}>
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-1 break-words text-sm font-semibold text-slate-100">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {lineItems.length > 0 ? (
              <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/15 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Lineas detectadas
                </p>
                <div className="mt-3 grid gap-2">
                  {lineItems.slice(0, 5).map((line, index) => (
                    <div className="rounded-xl bg-white/[0.035] p-3 text-xs text-slate-300" key={index}>
                      {String(line.description ?? line.detalle ?? `Linea ${index + 1}`)}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </PremiumCard>
        </div>

        <div className="space-y-5">
          <PremiumCard className="p-4 sm:p-5">
            <p className="text-base font-semibold text-white">Acciones</p>
            <div className="mt-4">
              <StageActions document={document} />
            </div>
          </PremiumCard>

          <PremiumCard className="p-4 sm:p-5">
            <p className="text-base font-semibold text-white">Contabilidad sugerida</p>
            <div className="mt-4 grid gap-3">
              {[
                ["Contraparte", getCounterpartyLabel(document)],
                ["Clasificacion", getClassificationLabel(document)],
                ["Cuenta sugerida", document.classification?.suggested_account ?? "Sin cuenta"],
                ["Centro de costo", document.classification?.suggested_cost_center_id ?? "Sin centro"],
                ["Confianza IA", formatDocumentConfidence(confidence)],
              ].map(([label, value]) => (
                <div className="rounded-xl border border-white/[0.07] bg-black/15 p-3" key={label}>
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-1 break-words text-sm font-semibold text-slate-100">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </PremiumCard>

          <PremiumCard className="border-cyan-300/16 bg-cyan-300/[0.045] p-4 sm:p-5">
            <p className="text-base font-semibold text-white">Sugerencias E7</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Prioriza validar emisor, contraparte y cuenta sugerida antes de convertir.
            </p>
            <Link
              className="om7-btn-secondary mt-4 justify-center px-4 py-2.5"
              href={`/documentos/${document.id}/distribucion`}
            >
              Abrir distribucion contable
            </Link>
          </PremiumCard>

          <PremiumCard className="p-4 sm:p-5">
            <p className="text-base font-semibold text-white">Trazabilidad</p>
            <div className="mt-4 grid gap-2 text-xs leading-5 text-slate-400">
              <p>Origen: {getSourceLabel(document)}</p>
              <p>Extraccion: {document.extraction?.extraction_provider ?? "Sin extraccion"}</p>
              <p>Estado extraccion: {document.extraction?.extraction_status ?? "Sin estado"}</p>
              <p>Usuario: {document.user_id}</p>
              <p>Ingreso: {formatDate(document.created_at)}</p>
              <p>Conversion: {document.converted_type ?? "Sin conversion"}</p>
              <p>Historial extracciones: {document.extractionHistory.length}</p>
            </div>
            {document.extractionHistory.length > 0 ? (
              <div className="mt-4 grid gap-2">
                {document.extractionHistory.slice(0, 4).map((extraction) => (
                  <div
                    className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3"
                    key={extraction.id}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-200">
                        {extraction.extraction_provider}
                      </p>
                      <span className="text-xs text-slate-500">
                        {formatDate(extraction.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {extraction.extraction_status} ·{" "}
                      {formatDocumentConfidence(extraction.confidence)}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
            {document.review_notes || document.convertedRecord?.review_notes ? (
              <div className="mt-4 rounded-xl border border-amber-300/16 bg-amber-300/[0.06] p-3">
                <p className="text-xs text-amber-100/70">Observaciones</p>
                <p className="mt-1 text-sm leading-6 text-amber-50/85">
                  {document.review_notes || document.convertedRecord?.review_notes}
                </p>
              </div>
            ) : null}
          </PremiumCard>
        </div>
      </section>
    </section>
  );
}

export default async function ReviewInboxPage({
  searchParams,
}: BandejaPageProps) {
  const params = (await searchParams) ?? {};
  const rawStatus = getParam(params, "status") ?? "all";
  const status = statusFilters.some((filter) => filter.key === rawStatus)
    ? rawStatus
    : "all";
  const rawActionFilter = getParam(params, "action") ?? "all";
  const actionFilter = actionFilters.some((filter) => filter.key === rawActionFilter)
    ? (rawActionFilter as ActionFilter)
    : "all";
  const q = getParam(params, "q") ?? "";
  const date = getParam(params, "date") ?? "";
  const selectedId = getParam(params, "doc") ?? "";
  const actionError = getParam(params, "error") ?? null;
  const actionNotice = getParam(params, "notice") ?? null;
  const { activeContext, documents } = await listClientUploadReviewDocuments();
  const activeCompany = activeContext.activeCompany;
  const operationalDocuments = documents.filter(isOperationalDocument);
  const filteredDocuments = operationalDocuments.filter((document) =>
    matchesFilters({ actionFilter, date, document, query: q, status }),
  );
  const selectedDocument = selectedId
    ? operationalDocuments.find((document) => document.id === selectedId) ?? null
    : null;
  const backToInboxHref = buildFilterHref({ action: actionFilter, date, q, status });
  const counts = {
    approved: operationalDocuments.filter((document) => getFlowState(document) === "approved").length,
    human_review: operationalDocuments.filter((document) => getFlowState(document) === "human_review").length,
    observed: operationalDocuments.filter((document) => getFlowState(document) === "observed").length,
    processed: operationalDocuments.filter((document) => getFlowState(document) === "processed").length,
    received: operationalDocuments.filter((document) => getFlowState(document) === "received").length,
  };

  return (
    <ModuleFrame>
      <div className="rounded-2xl border border-white/[0.08] bg-[#06101c]/95 p-4 shadow-xl shadow-black/20">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/60">
              OM7 Documentos
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
              Bandeja documental
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Mesa operativa para documentos pendientes de revision, aprobacion o conversion.
            </p>
          </div>
          <BackLink />
        </div>
      </div>

      {actionError ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/[0.08] p-5">
          <p className="text-sm font-semibold text-amber-100">
            No se pudo completar la accion
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-100/75">
            {actionError}
          </p>
        </PremiumCard>
      ) : null}

      {actionNotice ? (
        <PremiumCard className="border-emerald-300/20 bg-emerald-300/10 p-5">
          <p className="text-sm font-semibold text-emerald-50">
            Accion completada
          </p>
          <p className="mt-2 text-sm leading-6 text-emerald-100/80">
            {actionNotice}
          </p>
        </PremiumCard>
      ) : null}

      {!activeCompany ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/10 p-5">
          <p className="text-sm font-medium text-amber-100">
            Selecciona una empresa activa
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-100/75">
            El centro revisa documentos del cliente asociado a la empresa activa.
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
        <DocumentWorkspace backHref={backToInboxHref} document={selectedDocument} />
      ) : (
        <>
          <PremiumCard className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <form className="grid flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_170px_170px_160px_auto]" method="get">
                <input
                  className="h-12 min-w-0 rounded-xl border border-cyan-300/18 bg-cyan-300/[0.055] px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/45"
                  defaultValue={q}
                  name="q"
                  placeholder="Buscar documento en bandeja..."
                />
                <select
                  className="h-12 rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none"
                  defaultValue={status}
                  name="status"
                >
                  {statusFilters.map((filter) => (
                    <option className="bg-slate-950" key={filter.key} value={filter.key}>
                      {filter.label}
                    </option>
                  ))}
                </select>
                <select
                  className="h-12 rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none"
                  defaultValue={actionFilter}
                  name="action"
                >
                  {actionFilters.map((filter) => (
                    <option className="bg-slate-950" key={filter.key} value={filter.key}>
                      {filter.label}
                    </option>
                  ))}
                </select>
                <input
                  className="h-12 rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none"
                  defaultValue={date}
                  name="date"
                  type="date"
                />
                <button className="om7-btn-secondary h-12 px-4" type="submit">
                  Buscar
                </button>
              </form>
              <div className="flex flex-wrap gap-2 xl:justify-end">
                <OperationalCounter label="activos" tone="primary" value={operationalDocuments.length} />
                <OperationalCounter label="observados" tone="critical" value={counts.observed} />
                <OperationalCounter label="por aprobar" value={counts.human_review + counts.processed} />
                <OperationalCounter label="listos" tone="success" value={counts.approved} />
              </div>
            </div>
          </PremiumCard>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <PremiumCard className="p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-base font-semibold text-white">
                    Trabajo activo
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Solo pendientes, observados, revision humana y listos para convertir.
                  </p>
                </div>
                <span className="text-sm text-slate-500">
                  {filteredDocuments.length} de {operationalDocuments.length} visibles
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {statusFilters.map((filter) => (
                  <Link
                    className={[
                      "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                      status === filter.key
                        ? "border-cyan-300/30 bg-cyan-300/12 text-cyan-100"
                        : "border-white/[0.08] bg-white/[0.04] text-slate-400 hover:text-white",
                    ].join(" ")}
                    href={buildFilterHref({
                      action: actionFilter,
                      date,
                      q,
                      status: filter.key,
                    })}
                    key={filter.key}
                  >
                    {filter.label}
                  </Link>
                ))}
              </div>

              <div className="mt-5 grid gap-3">
                {filteredDocuments.length > 0 ? (
                  filteredDocuments.map((document) => (
                    <DocumentRow
                      actionFilter={actionFilter}
                      active={false}
                      date={date}
                      document={document}
                      key={document.id}
                      q={q}
                      status={status}
                    />
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/[0.1] bg-black/10 p-8 text-center text-sm leading-6 text-slate-500">
                    No hay documentos para estos filtros.
                  </div>
                )}
              </div>
            </PremiumCard>

            <UploadPanel disabled={!activeCompany} />
          </section>
        </>
      )}
    </ModuleFrame>
  );
}
