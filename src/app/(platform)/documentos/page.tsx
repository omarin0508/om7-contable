import Link from "next/link";
import {
  createInvoiceFromXmlAction,
  createPurchaseFromXmlAction,
  processDocumentAction,
  processDocumentWithVisionAction,
  uploadDocumentAction,
} from "@/app/(platform)/documentos/actions";
import {
  ExtractionSummary,
  getExtractionReference,
} from "@/components/documents/extraction-summary";
import {
  MetricCard,
  ModuleFrame,
  ModuleHeader,
  StatusBadge,
} from "@/components/modules/shared";
import { PremiumCard } from "@/components/ui/premium-card";
import { listDocumentExtractionsByCompany } from "@/lib/document-processing";
import { listDocumentsByCompany } from "@/lib/storage";

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  uploaded: "Subido",
  processing: "Procesando",
  processed: "Procesado",
  error: "Error",
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

  return !isXmlDocument(document) && (mimeType === "application/pdf" || mimeType.startsWith("image/") || filename.endsWith(".pdf"));
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

export default async function DocumentsPage() {
  const [{ activeContext, documents }, extractions] = await Promise.all([
    listDocumentsByCompany(),
    listDocumentExtractionsByCompany(),
  ]);
  const activeCompany = activeContext.activeCompany;
  const organization = activeContext.organization;
  const extractionByDocumentId = new Map(
    extractions.map((extraction) => [extraction.document_id, extraction]),
  );
  const totalSize = documents.reduce(
    (sum, document) => sum + Number(document.size_bytes ?? 0),
    0,
  );
  const pendingCount = documents.filter(
    (document) =>
      document.processing_status === "pending" ||
      document.processing_status === "uploaded",
  ).length;
  const xmlReferenceCounts = extractions.reduce<Record<string, number>>(
    (acc, extraction) => {
      const reference = getExtractionReference(extraction.extracted_data);

      if (reference) {
        acc[reference] = (acc[reference] ?? 0) + 1;
      }

      return acc;
    },
    {},
  );

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Documentos"
        description="Centro documental para cargar XML, PDFs e imágenes. Los XML se procesan automáticamente y pueden convertirse en compras o facturas."
      />

      {!activeCompany ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/10 p-5">
          <p className="text-sm font-medium text-amber-100">
            Selecciona una empresa activa
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-100/75">
            Los documentos se almacenan bajo una empresa especifica. Ve a
            Empresas y define el contexto antes de subir archivos.
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
          label="Empresa activa"
          value={activeCompany ? "Lista" : "Pendiente"}
        />
        <MetricCard
          detail={organization?.name ?? "Organizacion"}
          label="Documentos"
          value={String(documents.length)}
        />
        <MetricCard
          detail="Pendientes para OCR futuro"
          label="Por procesar"
          value={String(pendingCount)}
        />
        <MetricCard
          detail="Storage privado"
          label="Peso total"
          value={formatBytes(totalSize)}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <PremiumCard className="p-5">
          <p className="text-sm font-medium text-white">Subir documento</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {activeCompany
              ? `Se guardara en ${activeCompany.name}.`
              : "Selecciona una empresa activa antes de subir."}
          </p>

          <form
            action={uploadDocumentAction}
            className="mt-5 space-y-4"
          >
            <input name="redirectTo" type="hidden" value="/documentos" />
            <input name="relatedType" type="hidden" value="general" />

            <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-200/20 bg-cyan-200/[0.04] px-5 py-8 text-center transition hover:border-cyan-200/35 hover:bg-cyan-200/[0.07]">
              <span className="text-sm font-medium text-cyan-100">
                Arrastra o selecciona XML, PDF o imagen
              </span>
              <span className="mt-2 max-w-xs text-xs leading-5 text-slate-500">
                Bucket privado con URLs firmadas temporales. OCR e IA se
                conectaran despues.
              </span>
              <input
                accept="application/pdf,image/*,.xml,application/xml,text/xml"
                className="mt-5 block w-full max-w-xs rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-950"
                disabled={!activeCompany}
                name="file"
                required
                type="file"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-300">
                  Tipo documento
                </span>
                <select
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
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
              </label>

              <div className="rounded-xl border border-white/[0.08] bg-white/[0.035] p-3">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                  Ruta logica
                </p>
                <p className="mt-2 break-all text-xs leading-5 text-slate-400">
                  organizations/{organization?.id ?? "org"}/companies/
                  {activeCompany?.id ?? "company"}/documents/
                </p>
              </div>
            </div>

            <button
              className="flex h-12 w-full items-center justify-center rounded-xl bg-cyan-100 px-4 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!activeCompany}
              type="submit"
            >
              Subir documento
            </button>
          </form>
        </PremiumCard>

        <PremiumCard className="overflow-hidden">
          <div className="border-b border-white/[0.07] px-5 py-4">
            <p className="text-sm font-medium text-white">
              Documentos recientes
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Archivos reales almacenados en Supabase Storage privado.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.16em] text-slate-600">
                <tr>
                  <th className="px-5 py-3 font-medium">Nombre</th>
                  <th className="px-5 py-3 font-medium">Tipo</th>
                  <th className="px-5 py-3 font-medium">Tamano</th>
                  <th className="px-5 py-3 font-medium">Fecha</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 font-medium">Accion</th>
                  <th className="px-5 py-3 font-medium">Procesamiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {documents.length > 0 ? (
                  documents.map((document) => {
                    const extraction = extractionByDocumentId.get(document.id);
                    const aiProcessed =
                      extraction?.extraction_provider === "openai-vision" &&
                      extraction.extraction_status === "processed";
                    const aiError =
                      extraction?.extraction_provider === "openai-vision" &&
                      extraction.extraction_status === "error";

                    return (
                      <tr key={document.id}>
                        <td className="px-5 py-4 font-medium text-white">
                          {document.original_filename ?? "Documento"}
                        </td>
                        <td className="px-5 py-4 text-slate-400">
                          {document.document_type}
                        </td>
                        <td className="px-5 py-4 text-slate-400">
                          {formatBytes(document.size_bytes)}
                        </td>
                        <td className="px-5 py-4 text-slate-400">
                          {formatDate(document.created_at)}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge>
                            {aiProcessed
                              ? "IA procesado"
                              : aiError
                                ? "Error IA"
                                : document.processing_status === "processed" &&
                            isXmlDocument(document)
                              ? "XML procesado"
                              : statusLabels[document.processing_status] ??
                                document.processing_status}
                          </StatusBadge>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            {document.signedUrl ? (
                              <a
                                className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08]"
                                href={document.signedUrl}
                                rel="noreferrer"
                                target="_blank"
                              >
                                Ver documento
                              </a>
                            ) : (
                              <span className="text-xs text-slate-600">
                                Sin enlace
                              </span>
                            )}
                            {extraction ? (
                              <a
                                className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-medium text-emerald-100 transition hover:bg-emerald-300/15"
                                href={`#extraccion-${extraction.id}`}
                              >
                                Ver extraccion
                              </a>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {isAiProcessableDocument(document) && !aiProcessed ? (
                            <form action={processDocumentWithVisionAction}>
                              <input
                                name="redirectTo"
                                type="hidden"
                                value="/documentos"
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
                          ) : (
                            <span className="text-xs text-slate-600">
                              {aiProcessed ? "Listo" : "No requiere IA"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      className="px-5 py-10 text-center text-sm text-slate-500"
                      colSpan={7}
                    >
                      No hay documentos registrados para la empresa activa.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </PremiumCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <PremiumCard className="p-5">
          <details>
            <summary className="cursor-pointer text-sm font-medium text-white">
              Herramienta tecnica de extraccion manual
            </summary>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Uso interno para pruebas antes de conectar OCR real. El flujo
              normal para usuarios es subir XML y revisar los datos detectados.
            </p>

            <form action={processDocumentAction} className="mt-5 space-y-4">
              <input name="redirectTo" type="hidden" value="/documentos" />

              <label className="block">
                <span className="text-sm font-medium text-slate-300">
                  Documento
                </span>
                <select
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                  disabled={!activeCompany || documents.length === 0}
                  name="documentId"
                  required
                >
                  <option className="bg-slate-950" value="">
                    Seleccionar documento
                  </option>
                  {documents.map((document) => (
                    <option
                      className="bg-slate-950"
                      key={document.id}
                      value={document.id}
                    >
                      {document.original_filename ?? document.id}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-300">
                  Texto extraido
                </span>
                <textarea
                  className="mt-2 min-h-32 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                  disabled={!activeCompany || documents.length === 0}
                  name="rawText"
                  placeholder="Pega aqui texto OCR manual o una simulacion..."
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-300">
                  Datos tecnicos estructurados
                </span>
                <textarea
                  className="mt-2 min-h-40 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 py-3 font-mono text-xs text-cyan-50 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                  defaultValue={JSON.stringify(
                    {
                      supplier_name: "",
                      document_number: "",
                      date: "",
                      currency: "",
                      subtotal: 0,
                      tax: 0,
                      total: 0,
                      line_items: [],
                    },
                    null,
                    2,
                  )}
                  disabled={!activeCompany || documents.length === 0}
                  name="extractedData"
                />
              </label>

              <button
                className="flex h-12 w-full items-center justify-center rounded-xl bg-cyan-100 px-4 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:opacity-50"
                disabled={!activeCompany || documents.length === 0}
                type="submit"
              >
                Guardar extraccion
              </button>
            </form>
          </details>
        </PremiumCard>

        <PremiumCard className="overflow-hidden">
          <div className="border-b border-white/[0.07] px-5 py-4">
            <p className="text-sm font-medium text-white">
              Panel de extracciones
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Lecturas manuales listas para evolucionar a OCR e IA.
            </p>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {extractions.length > 0 ? (
              extractions.map((extraction) => (
                <article
                  className="px-5 py-4"
                  id={`extraccion-${extraction.id}`}
                  key={extraction.id}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge>
                      {statusLabels[extraction.extraction_status] ??
                        extraction.extraction_status}
                    </StatusBadge>
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-slate-400">
                      {extraction.extraction_provider}
                    </span>
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-slate-400">
                      Confianza {extraction.confidence ?? 0}%
                    </span>
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-slate-400">
                      Procesado: {formatDate(extraction.processed_at)}
                    </span>
                  </div>

                  <div className="mt-4 space-y-4">
                    <ExtractionSummary extractedData={extraction.extracted_data} />

                    {(() => {
                      const reference = getExtractionReference(
                        extraction.extracted_data,
                      );
                      const duplicateWarning =
                        reference && xmlReferenceCounts[reference] > 1;

                      return duplicateWarning ? (
                        <p className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
                          Posible duplicado: ya existe otra extraccion con la
                          misma clave o consecutivo.
                        </p>
                      ) : null;
                    })()}

                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                      <p className="text-sm font-medium text-white">Acciones</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <form action={createPurchaseFromXmlAction}>
                          <input
                            name="extractionId"
                            type="hidden"
                            value={extraction.id}
                          />
                          <button
                            className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-medium text-emerald-100 transition hover:bg-emerald-300/15"
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
                            className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/15"
                            type="submit"
                          >
                            Crear factura
                          </button>
                        </form>
                      </div>
                    </div>

                    {extraction.error_message ? (
                      <p className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs leading-5 text-rose-100">
                        {extraction.error_message}
                      </p>
                    ) : null}

                    <details className="rounded-2xl border border-white/[0.08] bg-black/15 p-4">
                      <summary className="cursor-pointer text-sm font-medium text-slate-200">
                        Ver texto extraido
                      </summary>
                      <pre className="mt-4 max-h-40 overflow-auto rounded-xl border border-white/[0.08] bg-black/25 p-3 text-xs leading-5 text-slate-300">
                        {extraction.raw_text || "Sin texto extraido."}
                      </pre>
                    </details>
                  </div>
                </article>
              ))
            ) : (
              <p className="px-5 py-10 text-center text-sm text-slate-500">
                Todavia no hay extracciones registradas.
              </p>
            )}
          </div>
        </PremiumCard>
      </section>
    </ModuleFrame>
  );
}
