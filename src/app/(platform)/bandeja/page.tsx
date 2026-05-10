import Link from "next/link";
import {
  markDocumentRejectedAction,
  markDocumentReviewedAction,
} from "@/app/(platform)/bandeja/actions";
import {
  createInvoiceFromXmlAction,
  createPurchaseFromXmlAction,
} from "@/app/(platform)/documentos/actions";
import {
  MetricCard,
  ModuleFrame,
  ModuleHeader,
  StatusBadge,
} from "@/components/modules/shared";
import { PremiumCard } from "@/components/ui/premium-card";
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

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Bandeja"
        description="Revision operativa de documentos recibidos desde el portal cliente, con acciones rapidas para XML procesados."
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
          detail="Parser XML Costa Rica"
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

      <PremiumCard className="overflow-hidden">
        <div className="border-b border-white/[0.07] px-5 py-4">
          <p className="text-sm font-medium text-white">
            Documentos por revisar
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Solo documentos recibidos desde el portal cliente de la empresa
            activa.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1220px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-slate-600">
              <tr>
                <th className="px-5 py-3 font-medium">Archivo</th>
                <th className="px-5 py-3 font-medium">Tipo</th>
                <th className="px-5 py-3 font-medium">Tamano</th>
                <th className="px-5 py-3 font-medium">Fecha</th>
                <th className="px-5 py-3 font-medium">Proceso</th>
                <th className="px-5 py-3 font-medium">Revision</th>
                <th className="px-5 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {documents.length > 0 ? (
                documents.map((document) => {
                  const extraction = document.extraction;

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
                          {document.processing_status === "processed" &&
                          extraction?.extraction_provider === "xml-parser-cr"
                            ? "XML procesado"
                            : statusLabels[document.processing_status] ??
                              document.processing_status}
                        </StatusBadge>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge>
                          {statusLabels[document.review_status ?? "pending"] ??
                            document.review_status ??
                            "Pendiente"}
                        </StatusBadge>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {document.signedUrl ? (
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
                              href={`/documentos#extraccion-${extraction.id}`}
                            >
                              Ver extraccion XML
                            </Link>
                          ) : null}

                          {extraction?.extraction_provider === "xml-parser-cr" ? (
                            <>
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
                            </>
                          ) : null}

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
                              Revisado
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
                              Rechazar
                            </button>
                          </form>
                        </div>
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
                    No hay documentos de cliente para revisar con estos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PremiumCard>
    </ModuleFrame>
  );
}
