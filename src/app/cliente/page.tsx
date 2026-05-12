import Link from "next/link";
import {
  createInvoiceFromXmlAction,
  createPurchaseFromXmlAction,
  processDocumentWithVisionAction,
} from "@/app/(platform)/documentos/actions";
import { uploadClientDocumentAction } from "@/app/cliente/actions";
import { ExtractionSummary } from "@/components/documents/extraction-summary";
import { StatusBadge } from "@/components/modules/shared";
import { PremiumCard } from "@/components/ui/premium-card";
import { isInternalUser } from "@/lib/permissions";
import { listClientUploadDocumentsForCurrentUser } from "@/lib/storage";

type ClientPortalPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  uploaded: "Recibido",
  processing: "Procesando",
  processed: "Procesado",
  error: "Error",
};

type ClientPortalDocument = Awaited<
  ReturnType<typeof listClientUploadDocumentsForCurrentUser>
>["documents"][number];

function isXmlDocument(document: ClientPortalDocument) {
  return (
    document.mime_type?.includes("xml") ||
    document.original_filename?.toLowerCase().endsWith(".xml") ||
    false
  );
}

function isAiProcessableDocument(document: ClientPortalDocument) {
  const mimeType = document.mime_type ?? "";
  const filename = document.original_filename?.toLowerCase() ?? "";

  return (
    !isXmlDocument(document) &&
    (mimeType === "application/pdf" ||
      mimeType.startsWith("image/") ||
      filename.endsWith(".pdf"))
  );
}

function getDocumentState(document: ClientPortalDocument) {
  const extraction = document.extraction;

  if (document.converted_type === "purchase" || document.related_type === "purchase") {
    return "Compra creada";
  }

  if (document.converted_type === "invoice" || document.related_type === "invoice") {
    return "Factura creada";
  }

  if (extraction?.extraction_status === "reviewed") {
    return "Revisado";
  }

  if (extraction?.extraction_status === "processed") {
    return "Procesado";
  }

  if (
    document.processing_status === "uploaded" ||
    document.processing_status === "pending"
  ) {
    return isAiProcessableDocument(document) ? "Subido" : "Pendiente de revision";
  }

  return statusLabels[document.processing_status] ?? document.processing_status;
}

const flowSteps = [
  "Suba documentos",
  "Procesamos la informacion",
  "Revisamos y registramos",
  "Quedan organizados",
];

const highlights = [
  "XML automaticos",
  "PDFs e imagenes",
  "Documentos seguros",
  "Procesamiento organizado",
];

const uploadErrorMessages: Record<string, string> = {
  no_company: "No tiene una empresa asignada para subir documentos.",
  storage_failed: "No se pudo guardar el archivo. Intente de nuevo.",
  xml_processing_failed: "El XML se subió, pero no se pudo procesar.",
  permission_denied: "No tiene permisos para registrar documentos en esta empresa.",
  invalid_file: "El archivo no es valido. Use XML, PDF o imagen.",
  upload_failed: "No se pudo subir el documento. Intente de nuevo.",
};

const uploadWarningMessages: Record<string, string> = {
  xml_processing_failed: "El XML se subió, pero no se pudo procesar.",
};

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

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function ClientPortalPage({
  searchParams,
}: ClientPortalPageProps) {
  const params = (await searchParams) ?? {};
  const selectedCompanyId = getParam(params, "companyId");
  const uploadError = getParam(params, "uploadError");
  const uploadWarning = getParam(params, "uploadWarning");
  const uploadStatus = getParam(params, "uploadStatus");
  const [{ activeCompany, companies, documents: clientUploads }, internalUser] =
    await Promise.all([
      listClientUploadDocumentsForCurrentUser(selectedCompanyId),
      isInternalUser(),
    ]);

  const sentCount = clientUploads.length;
  const xmlProcessedCount = clientUploads.filter(
    (document) =>
      document.processing_status === "processed" &&
      (document.mime_type?.includes("xml") ||
        document.original_filename?.toLowerCase().endsWith(".xml")),
  ).length;
  const pendingCount = clientUploads.filter(
    (document) =>
      document.processing_status === "pending" ||
      document.processing_status === "uploaded" ||
      document.processing_status === "processing",
  ).length;
  const lastUpload = clientUploads[0]?.created_at ?? null;

  return (
    <main className="min-h-screen overflow-hidden bg-[#03050a] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_16%_0%,rgba(34,211,238,0.16),transparent_30%),radial-gradient(circle_at_80%_12%,rgba(16,185,129,0.12),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.035),transparent_34%)]" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.1] via-white/[0.045] to-cyan-300/[0.04] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  className="inline-flex items-center gap-3"
                  href={internalUser ? "/dashboard" : "/cliente"}
                >
                  <span className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-sm font-semibold text-cyan-100">
                    OM7
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-white">
                      OM7 Finance OS
                    </span>
                    <span className="text-xs text-slate-500">
                      Portal Cliente
                    </span>
                  </span>
                </Link>
                {internalUser ? (
                  <Link
                    className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08]"
                    href="/cliente"
                    target="_blank"
                  >
                    Abrir Portal Cliente
                  </Link>
                ) : null}
              </div>

              <h1 className="mt-8 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Portal Cliente
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Suba aqui sus facturas XML, PDFs o imagenes para procesamiento
                documental y contable.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {highlights.map((highlight) => (
                  <span
                    className="rounded-full border border-white/[0.08] bg-black/20 px-3 py-1.5 text-xs font-medium text-slate-200"
                    key={highlight}
                  >
                    {highlight}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4 lg:min-w-72">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                Espacio documental
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {activeCompany?.name ?? "Sin empresa asignada"}
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Los archivos quedan protegidos y asociados a su cuenta para
                revision del equipo contable.
              </p>
            </div>
          </div>
        </header>

        {companies.length > 1 ? (
          <PremiumCard className="p-5">
            <form
              action="/cliente"
              className="grid gap-4 sm:grid-cols-[1fr_auto]"
              method="get"
            >
              <label className="block">
                <span className="text-sm font-medium text-slate-300">
                  Cliente / empresa asignada
                </span>
                <select
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10"
                  defaultValue={activeCompany?.id ?? ""}
                  name="companyId"
                >
                  {companies.map((company) => (
                    <option
                      className="bg-slate-950"
                      key={company.id}
                      value={company.id}
                    >
                      {company.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="h-11 self-end rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15"
                type="submit"
              >
                Ver empresa
              </button>
            </form>
          </PremiumCard>
        ) : null}

        {!activeCompany ? (
          <PremiumCard className="border-amber-300/15 bg-amber-300/10 p-5">
            <p className="text-sm font-medium text-amber-100">
              Aun no tienes una empresa asignada
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-100/75">
              Este portal usa empresas asignadas a tu usuario. Si no ves una
              empresa, solicita acceso al equipo contable.
            </p>
          </PremiumCard>
        ) : null}

        {uploadError ? (
          <PremiumCard className="border-rose-300/15 bg-rose-300/10 p-5">
            <p className="text-sm font-medium text-rose-100">
              No se pudo completar la subida
            </p>
            <p className="mt-2 text-sm leading-6 text-rose-100/75">
              {uploadErrorMessages[uploadError] ?? uploadErrorMessages.upload_failed}
            </p>
          </PremiumCard>
        ) : null}

        {uploadWarning ? (
          <PremiumCard className="border-amber-300/15 bg-amber-300/10 p-5">
            <p className="text-sm font-medium text-amber-100">
              Documento recibido con observacion
            </p>
            <p className="mt-2 text-sm leading-6 text-amber-100/75">
              {uploadWarningMessages[uploadWarning] ??
                "El documento se subio, pero requiere revision."}
            </p>
          </PremiumCard>
        ) : null}

        {uploadStatus === "success" ? (
          <PremiumCard className="border-emerald-300/15 bg-emerald-300/10 p-5">
            <p className="text-sm font-medium text-emerald-100">
              Documento enviado correctamente
            </p>
            <p className="mt-2 text-sm leading-6 text-emerald-100/75">
              El equipo contable ya puede revisarlo desde la bandeja.
            </p>
          </PremiumCard>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <PremiumCard className="p-4">
            <p className="text-xs text-slate-500">Documentos enviados</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {sentCount}
            </p>
          </PremiumCard>
          <PremiumCard className="p-4">
            <p className="text-xs text-slate-500">XML procesados</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {xmlProcessedCount}
            </p>
          </PremiumCard>
          <PremiumCard className="p-4">
            <p className="text-xs text-slate-500">En revision</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {pendingCount}
            </p>
          </PremiumCard>
          <PremiumCard className="p-4">
            <p className="text-xs text-slate-500">Ultimo envio</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {formatDate(lastUpload)}
            </p>
          </PremiumCard>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <PremiumCard className="p-5 sm:p-6">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-white">
                Enviar documentos
              </p>
              <p className="max-w-xl text-sm leading-6 text-slate-400">
                Arrastre documentos aqui o seleccionelos desde su dispositivo.
                Soporta XML, PDF e imagenes.
              </p>
            </div>

            <div className="mt-5 grid gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 text-sm leading-6 text-slate-300 sm:grid-cols-3">
              <p>
                <span className="font-semibold text-white">1. Suba</span> XML,
                PDF o foto de factura.
              </p>
              <p>
                <span className="font-semibold text-white">2. OM7 procesa</span>{" "}
                el documento de forma segura.
              </p>
              <p>
                <span className="font-semibold text-white">3. Su contador</span>{" "}
                revisa y le avisa si falta algo.
              </p>
            </div>

            <form action={uploadClientDocumentAction} className="mt-6 space-y-5">
              <label className="block">
                <span className="text-sm font-medium text-slate-300">
                  Cliente / empresa
                </span>
                {companies.length > 1 ? (
                  <select
                    className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                    defaultValue={activeCompany?.id ?? ""}
                    disabled={!activeCompany}
                    name="companyId"
                  >
                    {companies.map((company) => (
                      <option
                        className="bg-slate-950"
                        key={company.id}
                        value={company.id}
                      >
                        {company.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <>
                    <input
                      name="companyId"
                      type="hidden"
                      value={activeCompany?.id ?? ""}
                    />
                    <div className="mt-2 rounded-xl border border-white/[0.08] bg-black/20 px-3.5 py-3 text-sm text-slate-300">
                      {activeCompany?.name ?? "Sin empresa asignada"}
                    </div>
                  </>
                )}
              </label>

              <label className="flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-cyan-200/25 bg-cyan-200/[0.045] px-6 py-10 text-center shadow-[0_0_42px_rgba(34,211,238,0.08)] transition hover:border-cyan-200/45 hover:bg-cyan-200/[0.07]">
                <span className="grid h-14 w-14 place-items-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-lg font-semibold text-cyan-100">
                  +
                </span>
                <span className="mt-5 text-base font-semibold text-white">
                  Arrastre documentos aqui o seleccionelos desde su dispositivo.
                </span>
                <span className="mt-3 max-w-sm text-sm leading-6 text-slate-500">
                  XML, PDF, JPG, PNG o WEBP. Los XML se procesan
                  automaticamente y los demas archivos quedan listos para
                  revision.
                </span>
                <input
                  accept="application/pdf,image/*,.xml,application/xml,text/xml"
                  className="mt-6 block w-full max-w-sm rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-950"
                  disabled={!activeCompany}
                  name="file"
                  required
                  type="file"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-300">
                  Tipo documento
                </span>
                <select
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                  defaultValue="factura"
                  disabled={!activeCompany}
                  name="documentType"
                >
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

              <button
                className="flex h-12 w-full items-center justify-center rounded-xl bg-cyan-100 px-4 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!activeCompany}
                type="submit"
              >
                Enviar documento
              </button>
            </form>
          </PremiumCard>

          <div className="flex flex-col gap-5">
            <PremiumCard className="p-5">
              <p className="text-sm font-medium text-white">
                Como funciona
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {flowSteps.map((step, index) => (
                  <div
                    className="rounded-2xl border border-white/[0.08] bg-black/15 p-4"
                    key={step}
                  >
                    <p className="text-xs font-medium text-cyan-100">
                      0{index + 1}
                    </p>
                    <p className="mt-2 text-sm font-medium text-white">
                      {step}
                    </p>
                  </div>
                ))}
              </div>
            </PremiumCard>

            <PremiumCard className="p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <p className="text-sm font-medium text-white">
                  Documentos recientes
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Archivos enviados desde su Portal Cliente.
                </p>
              </div>

              <div className="mt-5 pr-0 lg:max-h-[70vh] lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
                <div className="grid gap-3">
                {clientUploads.length > 0 ? (
                  clientUploads.map((document) => (
                    <article
                      className="rounded-2xl border border-white/[0.08] bg-black/15 p-4"
                      key={document.id}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                        <p className="break-words text-sm font-medium text-white">
                          {document.original_filename ?? "Documento"}
                        </p>
                        <p className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                          {document.document_type} · {formatBytes(document.size_bytes)} ·{" "}
                          {formatDate(document.created_at)}
                        </p>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
                          {isXmlDocument(document) ? (
                            <Link
                              className="grid h-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.08]"
                              href={`/visor-documento/${document.id}`}
                            >
                              Ver documento
                            </Link>
                          ) : document.signedUrl ? (
                            <a
                              className="grid h-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.08]"
                              href={document.signedUrl}
                              rel="noreferrer"
                              target="_blank"
                            >
                              Ver documento
                            </a>
                          ) : null}
                          {internalUser &&
                          isAiProcessableDocument(document) &&
                          !document.extraction ? (
                            <form action={processDocumentWithVisionAction}>
                              <input
                                name="redirectTo"
                                type="hidden"
                                value="/cliente"
                              />
                              <input
                                name="documentId"
                                type="hidden"
                                value={document.id}
                              />
                              <button
                                className="grid h-10 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/15"
                                type="submit"
                              >
                                Procesar
                              </button>
                            </form>
                          ) : document.extraction ? (
                            <a
                              className="grid h-10 place-items-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/15"
                              href={`#extraccion-${document.extraction.id}`}
                            >
                              {document.extraction.extraction_status === "reviewed"
                                ? "Ver extraccion"
                                : "Revisar datos"}
                            </a>
                          ) : (
                            <span className="grid h-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-xs font-medium text-slate-400">
                              Pendiente de revision
                            </span>
                          )}
                          <StatusBadge>{getDocumentState(document)}</StatusBadge>
                        </div>
                      </div>
                      {document.extraction ? (
                        <details
                          className="mt-4 rounded-2xl border border-white/[0.08] bg-black/15 p-4"
                          id={`extraccion-${document.extraction.id}`}
                        >
                          <summary className="cursor-pointer text-sm font-medium text-slate-200">
                            Ver extraccion
                          </summary>
                          <div className="mt-4 space-y-4">
                            <ExtractionSummary
                              extractedData={document.extraction.extracted_data}
                            />
                            {internalUser ? (
                              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                                <p className="text-sm font-medium text-white">
                                  Acciones internas
                                </p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                  {document.converted_type ? (
                                    <Link
                                      className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-medium text-emerald-100 transition hover:bg-emerald-300/15"
                                      href={
                                        document.converted_type === "purchase"
                                          ? "/compras"
                                          : "/facturas"
                                      }
                                    >
                                      Ver{" "}
                                      {document.converted_type === "purchase"
                                        ? "compra"
                                        : "factura"}
                                    </Link>
                                  ) : null}
                                  {!document.converted_type &&
                                  document.extraction.extraction_status ===
                                    "reviewed" ? (
                                    <>
                                      <form action={createPurchaseFromXmlAction}>
                                        <input
                                          name="extractionId"
                                          type="hidden"
                                          value={document.extraction.id}
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
                                          value={document.extraction.id}
                                        />
                                        <button
                                          className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/15"
                                          type="submit"
                                        >
                                          Crear factura
                                        </button>
                                      </form>
                                    </>
                                  ) : !document.converted_type ? (
                                    <Link
                                      className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/15"
                                      href={`/documentos#extraccion-${document.extraction.id}`}
                                    >
                                      Revisar datos
                                    </Link>
                                  ) : null}
                                  {isAiProcessableDocument(document) &&
                                  document.extraction.extraction_status ===
                                    "error" ? (
                                    <form action={processDocumentWithVisionAction}>
                                      <input
                                        name="redirectTo"
                                        type="hidden"
                                        value="/cliente"
                                      />
                                      <input
                                        name="documentId"
                                        type="hidden"
                                        value={document.id}
                                      />
                                      <button
                                        className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/[0.08]"
                                        type="submit"
                                      >
                                        Reprocesar
                                      </button>
                                    </form>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </details>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.025] px-5 py-10 text-center text-sm text-slate-500">
                    Aun no hay documentos enviados.
                  </p>
                )}
                </div>
              </div>
            </PremiumCard>
          </div>
        </section>
      </div>
    </main>
  );
}
