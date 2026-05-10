import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  createInvoiceFromXmlAction,
  createPurchaseFromXmlAction,
} from "@/app/(platform)/documentos/actions";
import { ExtractionSummary } from "@/components/documents/extraction-summary";
import { normalizeCurrencyCode } from "@/lib/currency";
import { getCurrentUserRole } from "@/lib/permissions";
import { getDocumentViewerData } from "@/lib/storage";

type DocumentViewerPageProps = {
  params: Promise<{
    documentId: string;
  }>;
};

const workflowLabels: Record<string, string> = {
  pending: "Pendiente",
  uploaded: "Subido",
  processing: "Procesando",
  processed: "Procesado",
  reviewed: "Revisado",
  rejected: "Rechazado",
  error: "Error",
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

function getDataValue(data: Record<string, unknown>, keys: string[], fallback = "No disponible") {
  for (const key of keys) {
    const value = data[key];

    if (value !== null && value !== undefined && value !== "") {
      return String(value);
    }
  }

  return fallback;
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

function getMoney(data: Record<string, unknown>, key: string) {
  const amount = Number(data[key] ?? 0);

  if (!Number.isFinite(amount)) {
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

function getBackHref(referer: string | null) {
  if (!referer) {
    return "/documentos";
  }

  try {
    const url = new URL(referer);
    const allowedPaths = ["/documentos", "/bandeja", "/cliente"];

    if (
      allowedPaths.some(
        (path) => url.pathname === path || url.pathname.startsWith(`${path}/`),
      )
    ) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    return "/documentos";
  }

  return "/documentos";
}

export default async function DocumentViewerPage({
  params,
}: DocumentViewerPageProps) {
  const { documentId } = await params;
  const requestHeaders = await headers();
  const backHref = getBackHref(requestHeaders.get("referer"));
  const currentUser = await getCurrentUserRole();
  const viewer = await getDocumentViewerData(documentId).catch(() => null);

  if (!viewer) {
    notFound();
  }

  const { document, extraction, extractionHistory, rawFileText } = viewer;
  const xmlDocument = isXmlDocument(document);
  const extractedData =
    extraction?.extracted_data && typeof extraction.extracted_data === "object"
      ? (extraction.extracted_data as Record<string, unknown>)
      : {};
  const workflowStatus =
    extraction?.extraction_status ?? document.review_status ?? document.processing_status;
  const isInternal = currentUser.role === "internal";
  const isReviewed = extraction?.extraction_status === "reviewed";

  if (!xmlDocument) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/[0.08] bg-white/[0.04] p-6">
          <Link
            className="mb-5 inline-flex rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.08]"
            href={backHref}
          >
            Volver
          </Link>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">
            OM7 Finance OS
          </p>
          <h1 className="mt-3 text-2xl font-semibold">Documento original</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Este visor premium se usa para XML procesados. Para PDFs e imagenes
            se mantiene la vista previa original del navegador.
          </p>
          {viewer.signedUrl ? (
            <a
              className="mt-6 inline-flex rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/15"
              href={viewer.signedUrl}
              rel="noreferrer"
              target="_blank"
            >
              Abrir documento
            </a>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_32%),linear-gradient(135deg,#020617_0%,#0f172a_48%,#020617_100%)] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.045] shadow-2xl shadow-cyan-950/30 backdrop-blur">
          <div className="border-b border-white/[0.08] px-5 py-5 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/75">
                  OM7 Finance OS · Visor documental
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Documento XML procesado
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                  OM7 interpreta el XML original y lo presenta en una vista
                  humana para revision, auditoria y flujo contable.
                </p>
              </div>
              <div className="flex flex-col items-start gap-2 lg:items-end">
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <a
                    className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/15"
                    href="#vista-om7"
                  >
                    Vista OM7
                  </a>
                  <a
                    className="rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.09]"
                    href="#datos-tecnicos"
                  >
                    Ver XML tecnico
                  </a>
                  {viewer.downloadUrl ? (
                    <a
                      className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/15"
                      download={document.original_filename ?? "documento.xml"}
                      href={viewer.downloadUrl}
                    >
                      Descargar XML original
                    </a>
                  ) : null}
                </div>
                <Link
                  className="inline-flex rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.08]"
                  href={backHref}
                >
                  Volver
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
            {[
              ["Estado workflow", workflowLabels[workflowStatus] ?? workflowStatus],
              ["Proveedor / emisor", getDataValue(extractedData, ["emisor_nombre", "supplier_name"])],
              ["Fecha", getDataValue(extractedData, ["fecha_emision", "date"], formatDate(document.created_at))],
              ["Total", getMoney(extractedData, "total")],
            ].map(([label, value]) => (
              <div
                className="rounded-2xl border border-white/[0.08] bg-black/20 p-4"
                key={label}
              >
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-2 break-words text-sm font-semibold text-slate-100">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section
          className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]"
          id="vista-om7"
        >
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.045] p-5 backdrop-blur sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">
                  Resumen interpretado
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Datos principales detectados desde el comprobante XML.
                </p>
              </div>
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100">
                {extraction?.extraction_provider ?? "Sin extraccion"}
              </span>
            </div>
            <div className="mt-5">
              <ExtractionSummary
                extractedData={extractedData}
                showTechnicalJson={false}
              />
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-white/[0.08] bg-white/[0.045] p-5 backdrop-blur">
              <p className="text-sm font-semibold text-white">
                Acciones del workflow
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Conserve el XML original para respaldo y use los datos
                interpretados para continuar el proceso contable.
              </p>
              <div className="mt-5 grid gap-2">
                {isInternal && extraction ? (
                  isReviewed ? (
                    <>
                      <form action={createPurchaseFromXmlAction}>
                        <input
                          name="extractionId"
                          type="hidden"
                          value={extraction.id}
                        />
                        <button
                          className="h-11 w-full rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/15"
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
                          className="h-11 w-full rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15"
                          type="submit"
                        >
                          Crear factura
                        </button>
                      </form>
                    </>
                  ) : (
                    <Link
                      className="grid h-11 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15"
                      href={`/documentos#extraccion-${extraction.id}`}
                    >
                      Revisar y aprobar datos
                    </Link>
                  )
                ) : (
                  <span className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-3 text-sm text-slate-400">
                    Documento recibido para revision interna.
                  </span>
                )}
                {viewer.signedUrl ? (
                  <a
                    className="grid h-11 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.09]"
                    href={viewer.signedUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Abrir archivo original
                  </a>
                ) : null}
              </div>
            </div>

            <div className="rounded-3xl border border-white/[0.08] bg-black/20 p-5">
              <p className="text-sm font-semibold text-white">Auditoria</p>
              <dl className="mt-4 space-y-3 text-xs">
                <div>
                  <dt className="text-slate-500">Archivo</dt>
                  <dd className="mt-1 break-words text-slate-200">
                    {document.original_filename ?? document.id}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Clave</dt>
                  <dd className="mt-1 break-words text-slate-200">
                    {getDataValue(extractedData, ["clave"])}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Consecutivo</dt>
                  <dd className="mt-1 break-words text-slate-200">
                    {getDataValue(extractedData, [
                      "numero_consecutivo",
                      "document_number",
                    ])}
                  </dd>
                </div>
              </dl>
            </div>
          </aside>
        </section>

        <details
          className="rounded-3xl border border-white/[0.08] bg-black/25 p-5"
          id="datos-tecnicos"
        >
          <summary className="cursor-pointer text-sm font-semibold text-slate-200">
            Ver XML tecnico, JSON y metadata
          </summary>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <section>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                XML raw
              </p>
              <pre className="mt-3 max-h-96 overflow-auto rounded-2xl border border-white/[0.08] bg-slate-950/80 p-4 text-xs leading-5 text-slate-300">
                {rawFileText || extraction?.raw_text || "XML no disponible."}
              </pre>
            </section>
            <section>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                JSON parseado
              </p>
              <pre className="mt-3 max-h-96 overflow-auto rounded-2xl border border-white/[0.08] bg-slate-950/80 p-4 text-xs leading-5 text-slate-300">
                {JSON.stringify(extractedData, null, 2)}
              </pre>
            </section>
            <section className="lg:col-span-2">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                Metadata e historial de extracciones
              </p>
              <pre className="mt-3 max-h-80 overflow-auto rounded-2xl border border-white/[0.08] bg-slate-950/80 p-4 text-xs leading-5 text-slate-300">
                {JSON.stringify(
                  {
                    document,
                    extraction_history: extractionHistory.map((item) => ({
                      id: item.id,
                      provider: item.extraction_provider,
                      status: item.extraction_status,
                      confidence: item.confidence,
                      processed_at: item.processed_at,
                      created_at: item.created_at,
                      error_message: item.error_message,
                    })),
                  },
                  null,
                  2,
                )}
              </pre>
            </section>
          </div>
        </details>
      </div>
    </main>
  );
}
