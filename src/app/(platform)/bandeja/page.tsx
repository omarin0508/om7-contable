import Link from "next/link";
import {
  markDocumentRejectedAction,
  markDocumentReviewedAction,
} from "@/app/(platform)/bandeja/actions";
import {
  createInvoiceFromXmlAction,
  createPurchaseFromXmlAction,
  processDocumentWithVisionAction,
} from "@/app/(platform)/documentos/actions";
import { DocumentExtractionWorkspace } from "@/components/documents/document-extraction-workspace";
import { ExtractionReviewForm } from "@/components/documents/extraction-review-form";
import { ExtractionSummary } from "@/components/documents/extraction-summary";
import {
  MetricCard,
  ModuleFrame,
  ModuleHeader,
  StatusBadge,
} from "@/components/modules/shared";
import { PremiumCard } from "@/components/ui/premium-card";
import { normalizeCurrencyCode } from "@/lib/currency";
import { listClientUploadReviewDocuments } from "@/lib/document-review";

type BandejaPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  uploaded: "Recibido",
  processing: "Procesando",
  processed: "Procesado",
  error: "Error",
  reviewed: "Revisado",
  rejected: "Rechazado",
};

function isXmlDocument(document: { mime_type: string | null; original_filename: string | null }) {
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

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
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

type InboxDocument = Awaited<
  ReturnType<typeof listClientUploadReviewDocuments>
>["documents"][number];

function getValue(value: unknown, fallback = "No disponible") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
}

function getMoney(value: unknown, currency: unknown) {
  const amount = Number(value ?? 0);
  const currencyCode = normalizeCurrencyCode(currency);

  if (!Number.isFinite(amount) || amount <= 0) {
    return "No disponible";
  }

  return `${currencyCode} ${amount.toLocaleString("es-CR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

function getDocumentState(document: InboxDocument) {
  const extraction = document.extraction;

  if (document.related_type === "purchase") {
    return "Compra creada";
  }

  if (document.related_type === "invoice") {
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

  if ((document.review_status ?? "pending") === "pending") {
    return document.processing_status === "uploaded"
      ? "Subido"
      : "Pendiente de revision";
  }

  return statusLabels[document.processing_status] ?? document.processing_status;
}

function getExtractionFacts(document: InboxDocument) {
  const data = document.extraction?.extracted_data;
  const currency = data?.moneda ?? data?.currency;

  return {
    supplier: getValue(data?.emisor_nombre ?? data?.supplier_name),
    documentDate: getValue(data?.fecha_emision ?? data?.date, "Sin fecha"),
    total: getMoney(data?.total, currency),
    provider: document.extraction?.extraction_provider ?? "Sin extraccion",
  };
}

export default async function ReviewInboxPage({ searchParams }: BandejaPageProps) {
  const params = (await searchParams) ?? {};
  const filters = {
    documentType: getParam(params, "documentType") ?? "all",
    processingStatus: getParam(params, "processingStatus") ?? "all",
    date: getParam(params, "date") ?? "",
  };
  const { activeContext, documents } =
    await listClientUploadReviewDocuments(filters);
  const activeCompany = activeContext.activeCompany;
  const receivedCount = documents.length;
  const xmlProcessedCount = documents.filter(
    (document) =>
      document.processing_status === "processed" &&
      document.extraction?.extraction_provider === "xml-parser-cr",
  ).length;
  const aiProcessedCount = documents.filter(
    (document) =>
      document.processing_status === "processed" &&
      document.extraction?.extraction_provider === "openai-vision",
  ).length;
  const pendingCount = documents.filter(
    (document) =>
      (document.review_status ?? "pending") === "pending" ||
      document.processing_status === "uploaded" ||
      document.processing_status === "pending",
  ).length;
  const errorCount = documents.filter(
    (document) =>
      document.processing_status === "error" ||
      (document.review_status ?? "pending") === "rejected",
  ).length;
  const documentsWithExtractions = documents.filter(
    (document) => document.extraction,
  );

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Bandeja"
        description="Revise documentos recibidos desde el portal cliente o cargas internas antes de convertirlos en registros."
        action={
          <Link
            className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08]"
            href="/documentos"
          >
            Volver a documentos
          </Link>
        }
      />

      {!activeCompany ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/10 p-5">
          <p className="text-sm font-medium text-amber-100">
            Selecciona una empresa activa
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-100/75">
            La bandeja revisa documentos del cliente asociado a la empresa
            activa.
          </p>
          <Link
            className="mt-4 inline-flex rounded-xl border border-amber-200/20 bg-black/15 px-4 py-2 text-sm font-medium text-amber-100 transition hover:bg-black/25"
            href="/empresas"
          >
            Ir a empresas
          </Link>
        </PremiumCard>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail={activeCompany?.name ?? "Sin empresa activa"}
          label="Recibidos"
          value={String(receivedCount)}
        />
        <MetricCard
          detail={`IA procesados: ${aiProcessedCount}`}
          label="XML procesados"
          value={String(xmlProcessedCount)}
        />
        <MetricCard
          detail="Carga o revision pendiente"
          label="Pendientes"
          value={String(pendingCount)}
        />
        <MetricCard
          detail="Procesamiento o revision"
          label="Errores"
          value={String(errorCount)}
        />
      </section>

      <PremiumCard className="p-5">
        <form className="grid gap-4 md:grid-cols-4" action="/bandeja">
          <label className="block">
            <span className="text-sm font-medium text-slate-300">
              Tipo documento
            </span>
            <select
              className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10"
              defaultValue={filters.documentType}
              name="documentType"
            >
              <option className="bg-slate-950" value="all">
                Todos
              </option>
              <option className="bg-slate-950" value="factura">
                Factura
              </option>
              <option className="bg-slate-950" value="compra">
                Compra
              </option>
              <option className="bg-slate-950" value="otro">
                Otro
              </option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-300">
              Procesamiento
            </span>
            <select
              className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10"
              defaultValue={filters.processingStatus}
              name="processingStatus"
            >
              <option className="bg-slate-950" value="all">
                Todos
              </option>
              <option className="bg-slate-950" value="uploaded">
                Recibido
              </option>
              <option className="bg-slate-950" value="processed">
                Procesado
              </option>
              <option className="bg-slate-950" value="error">
                Error
              </option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-300">Fecha</span>
            <input
              className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10"
              defaultValue={filters.date}
              name="date"
              type="date"
            />
          </label>

          <div className="flex items-end gap-2">
            <button
              className="h-11 flex-1 rounded-xl bg-cyan-100 px-4 text-sm font-semibold text-slate-950 transition hover:bg-white"
              type="submit"
            >
              Filtrar
            </button>
            <Link
              className="grid h-11 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm font-medium text-slate-300 transition hover:bg-white/[0.08]"
              href="/bandeja"
            >
              Limpiar
            </Link>
          </div>
        </form>
      </PremiumCard>

      <PremiumCard className="p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-white">
              Documentos por revisar
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Centro operativo para procesar, revisar y convertir documentos.
            </p>
          </div>
          <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-slate-400">
            {documents.length} documentos
          </span>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {documents.length > 0 ? (
            documents.map((document) => {
              const extraction = document.extraction;
              const isReviewed = extraction?.extraction_status === "reviewed";
              const state = getDocumentState(document);
              const facts = getExtractionFacts(document);
              const canProcess =
                isAiProcessableDocument(document) &&
                (!extraction || extraction.extraction_status === "error");

              return (
                <article
                  className="rounded-2xl border border-white/[0.08] bg-black/15 p-4"
                  key={document.id}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge>{state}</StatusBadge>
                        <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-slate-400">
                          {facts.provider}
                        </span>
                      </div>
                      <p className="mt-3 break-words text-sm font-semibold text-white">
                        {document.original_filename ?? "Documento"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {activeCompany?.name ?? "Empresa activa"} ·{" "}
                        {document.document_type} · {formatBytes(document.size_bytes)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {canProcess ? (
                        <form action={processDocumentWithVisionAction}>
                          <input name="redirectTo" type="hidden" value="/bandeja" />
                          <input name="documentId" type="hidden" value={document.id} />
                          <button
                            className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/15"
                            type="submit"
                          >
                            {extraction?.extraction_status === "error"
                              ? "Reintentar"
                              : "Procesar"}
                          </button>
                        </form>
                      ) : extraction && !isReviewed ? (
                        <Link
                          className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/15"
                          href={`#extraccion-${extraction.id}`}
                        >
                          Revisar datos
                        </Link>
                      ) : null}

                      {isReviewed && extraction ? (
                        <>
                          <form action={createPurchaseFromXmlAction}>
                            <input
                              name="extractionId"
                              type="hidden"
                              value={extraction.id}
                            />
                            <button
                              className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/15"
                              type="submit"
                            >
                              Crear compra
                            </button>
                          </form>
                          <form action={createInvoiceFromXmlAction}>
                            <input
                              name="extractionId"
                              type="hidden"
                              value={extraction.id}
                            />
                            <button
                              className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/15"
                              type="submit"
                            >
                              Crear factura
                            </button>
                          </form>
                        </>
                      ) : null}

                      {state === "Compra creada" ? (
                        <Link
                          className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08]"
                          href="/compras"
                        >
                          Ver registro
                        </Link>
                      ) : null}
                      {state === "Factura creada" ? (
                        <Link
                          className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08]"
                          href="/facturas"
                        >
                          Ver registro
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                      <p className="text-xs text-slate-500">Proveedor</p>
                      <p className="mt-1 break-words text-sm font-medium text-slate-100">
                        {facts.supplier}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                      <p className="text-xs text-slate-500">Fecha documento</p>
                      <p className="mt-1 text-sm font-medium text-slate-100">
                        {facts.documentDate}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                      <p className="text-xs text-slate-500">Total</p>
                      <p className="mt-1 text-sm font-semibold text-cyan-50">
                        {facts.total}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {isXmlDocument(document) ? (
                      <Link
                        className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08]"
                        href={`/visor-documento/${document.id}`}
                      >
                        Ver documento
                      </Link>
                    ) : document.signedUrl ? (
                      <a
                        className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08]"
                        href={document.signedUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Ver documento
                      </a>
                    ) : null}
                    {extraction ? (
                      <Link
                        className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-medium text-emerald-100 transition hover:bg-emerald-300/15"
                        href={`#extraccion-${extraction.id}`}
                      >
                        Ver extraccion
                      </Link>
                    ) : null}
                    <form action={markDocumentReviewedAction}>
                      <input name="documentId" type="hidden" value={document.id} />
                      <button
                        className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08]"
                        type="submit"
                      >
                        Marcar revisado
                      </button>
                    </form>
                    <form action={markDocumentRejectedAction}>
                      <input name="documentId" type="hidden" value={document.id} />
                      <button
                        className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs font-medium text-rose-100 transition hover:bg-rose-300/15"
                        type="submit"
                      >
                        Rechazar
                      </button>
                    </form>
                  </div>
                </article>
              );
            })
          ) : (
            <p className="rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.025] px-5 py-10 text-center text-sm text-slate-500 xl:col-span-2">
              No hay documentos de cliente para revisar con estos filtros.
            </p>
          )}
        </div>
      </PremiumCard>

      <PremiumCard className="overflow-hidden">
        <div className="border-b border-white/[0.07] px-5 py-4">
          <p className="text-sm font-medium text-white">
            Documento procesado
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Vista humana de la extraccion principal antes de crear compras o
            facturas.
          </p>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {documentsWithExtractions.length > 0 ? (
            documentsWithExtractions.map((document) =>
              document.extraction ? (
                <DocumentExtractionWorkspace
                  createdAtLabel={formatDate(document.created_at)}
                  documentId={document.id}
                  documentName={document.original_filename ?? "Documento"}
                  documentType={document.document_type}
                  extraction={document.extraction}
                  history={document.extractionHistory}
                  mimeType={document.mime_type}
                  relatedType={document.related_type}
                  key={document.id}
                  redirectTo="/bandeja"
                  signedUrl={document.signedUrl}
                />
              ) : null,
            )
          ) : (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              No hay extracciones disponibles para los documentos filtrados.
            </p>
          )}
        </div>
      </PremiumCard>

      <details className="rounded-2xl border border-white/[0.08] bg-black/15">
        <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-slate-200">
          Historial de extracciones
        </summary>
      <PremiumCard className="overflow-hidden">
        <div className="border-b border-white/[0.07] px-5 py-4">
          <p className="text-sm font-medium text-white">
            Extracciones detectadas
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Vista operativa de los datos leidos antes de crear compras o
            facturas.
          </p>
        </div>

        <div className="divide-y divide-white/[0.06]">
          {documentsWithExtractions.length > 0 ? (
            documentsWithExtractions.map((document) => {
              const extraction = document.extraction;

              if (!extraction) {
                return null;
              }
              const isReviewed = extraction.extraction_status === "reviewed";

              return (
                <article className="px-5 py-5" key={document.id}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {document.original_filename ?? "Documento"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {document.document_type} · {formatDate(document.created_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {isXmlDocument(document) ? (
                        <Link
                          className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08]"
                          href={`/visor-documento/${document.id}`}
                        >
                          Ver documento
                        </Link>
                      ) : document.signedUrl ? (
                        <a
                          className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08]"
                          href={document.signedUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Ver documento
                        </a>
                      ) : null}
                      {isAiProcessableDocument(document) &&
                      extraction.extraction_provider !== "openai-vision" ? (
                        <form action={processDocumentWithVisionAction}>
                          <input
                            name="redirectTo"
                            type="hidden"
                            value="/bandeja"
                          />
                          <input
                            name="documentId"
                            type="hidden"
                            value={document.id}
                          />
                          <button
                            className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/15"
                            type="submit"
                          >
                            Procesar con IA
                          </button>
                        </form>
                      ) : null}
                      <form action={createPurchaseFromXmlAction}>
                        <input
                          name="extractionId"
                          type="hidden"
                          value={extraction.id}
                        />
                        <button
                          className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-medium text-emerald-100 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-45"
                          disabled={!isReviewed}
                          type="submit"
                        >
                          Crear compra
                        </button>
                      </form>
                      <form action={createInvoiceFromXmlAction}>
                        <input
                          name="extractionId"
                          type="hidden"
                          value={extraction.id}
                        />
                        <button
                          className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-45"
                          disabled={!isReviewed}
                          type="submit"
                        >
                          Crear factura
                        </button>
                      </form>
                      <form action={markDocumentReviewedAction}>
                        <input
                          name="documentId"
                          type="hidden"
                          value={document.id}
                        />
                        <button
                          className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08]"
                          type="submit"
                        >
                          Marcar revisado
                        </button>
                      </form>
                      <form action={markDocumentRejectedAction}>
                        <input
                          name="documentId"
                          type="hidden"
                          value={document.id}
                        />
                        <button
                          className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs font-medium text-rose-100 transition hover:bg-rose-300/15"
                          type="submit"
                        >
                          Marcar rechazado
                        </button>
                      </form>
                    </div>
                  </div>

                  <div className="mt-4">
                    <ExtractionSummary extractedData={extraction.extracted_data} />
                  </div>

                  {!isReviewed ? (
                    <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-100">
                      Revisa y guarda los datos detectados antes de crear una
                      compra o factura.
                    </p>
                  ) : null}

                  <details
                    className="mt-4 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.025] p-4"
                    id={`extraccion-${extraction.id}`}
                    open={!isReviewed}
                  >
                    <summary className="cursor-pointer text-sm font-medium text-cyan-100">
                      Revisar datos / Editar datos detectados
                    </summary>
                    <div className="mt-4">
                      <ExtractionReviewForm
                        extractedData={extraction.extracted_data}
                        extractionId={extraction.id}
                        redirectTo="/bandeja"
                      />
                    </div>
                  </details>
                </article>
              );
            })
          ) : (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              No hay extracciones disponibles para los documentos filtrados.
            </p>
          )}
        </div>
      </PremiumCard>
      </details>
    </ModuleFrame>
  );
}
