import Link from "next/link";
import { notFound } from "next/navigation";
import { processDocumentWithVisionAction } from "@/app/(platform)/documentos/actions";
import { DocumentManagementMenu } from "@/components/documents/document-management-menu";
import { DocumentExtractionWorkspace } from "@/components/documents/document-extraction-workspace";
import {
  MetricCard,
  ModuleFrame,
  ModuleHeader,
  StatusBadge,
} from "@/components/modules/shared";
import { PremiumCard } from "@/components/ui/premium-card";
import { getDocumentViewerData } from "@/lib/storage";

type DocumentWorkspacePageProps = {
  params: Promise<{
    documentId: string;
  }>;
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

function getWorkflowState(
  document: Awaited<ReturnType<typeof getDocumentViewerData>>["document"],
  extraction: Awaited<ReturnType<typeof getDocumentViewerData>>["extraction"],
) {
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

  return "Subido";
}

export default async function DocumentWorkspacePage({
  params,
}: DocumentWorkspacePageProps) {
  const { documentId } = await params;
  const viewer = await getDocumentViewerData(documentId).catch(() => null);

  if (!viewer) {
    notFound();
  }

  const { document, extraction, extractionHistory } = viewer;
  const state = getWorkflowState(document, extraction);
  const canProcessWithAi = isAiProcessableDocument(document);

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Workspace documento"
        description="Centro de revision enfocado para procesar, aprobar y convertir un documento."
        action={
          <div className="flex items-center justify-end gap-2">
            <Link
              className="om7-btn-ghost px-4 py-2.5"
              href="/documentos"
            >
              Volver a documentos
            </Link>
            <DocumentManagementMenu
              document={document}
              redirectTo={`/documentos/${document.id}`}
            />
          </div>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail={document.original_filename ?? document.id}
          label="Documento"
          value={document.document_type}
        />
        <MetricCard
          detail={document.mime_type ?? "Sin MIME"}
          label="Estado"
          value={state}
        />
        <MetricCard
          detail={extraction?.extraction_provider ?? "Sin extraccion"}
          label="Origen"
          value={extraction ? "Detectado" : "Pendiente"}
        />
        <MetricCard
          detail={formatDate(document.created_at)}
          label="Confianza"
          value={extraction?.confidence ? String(extraction.confidence) : "N/D"}
        />
      </section>

      {extraction ? (
        <PremiumCard className="overflow-hidden">
          <DocumentExtractionWorkspace
            createdAtLabel={formatDate(document.created_at)}
            documentId={document.id}
            documentName={document.original_filename ?? "Documento"}
            documentType={document.document_type}
            extraction={extraction}
            history={extractionHistory}
            mimeType={document.mime_type}
            redirectTo={`/documentos/${document.id}`}
            relatedType={document.related_type}
            signedUrl={viewer.signedUrl}
          />
        </PremiumCard>
      ) : (
        <PremiumCard className="p-5">
          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <section>
              <div className="flex flex-wrap gap-2">
                {["Subido", "Procesado", "Revisado", "Convertido"].map(
                  (step, index) => (
                    <span
                      className={[
                        "rounded-2xl border px-3 py-2 text-center text-xs font-semibold",
                        index === 0
                          ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-100"
                          : "border-white/[0.08] bg-black/15 text-slate-500",
                      ].join(" ")}
                      key={step}
                    >
                      {step}
                    </span>
                  ),
                )}
              </div>

              <div className="mt-5 rounded-2xl border border-white/[0.08] bg-black/15 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge>{state}</StatusBadge>
                  <span className="om7-chip text-slate-400">
                    Sin extraccion principal
                  </span>
                </div>
                <p className="mt-4 text-lg font-semibold text-white">
                  {document.original_filename ?? "Documento"}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Este documento esta cargado, pero todavia no tiene datos
                  estructurados. La siguiente accion depende del tipo de
                  archivo.
                </p>

                <div className="mt-5">
                  {canProcessWithAi ? (
                    <form action={processDocumentWithVisionAction}>
                      <input
                        name="redirectTo"
                        type="hidden"
                        value={`/documentos/${document.id}`}
                      />
                      <input name="documentId" type="hidden" value={document.id} />
                      <button
                        className="om7-btn-primary h-12 w-full px-4"
                        type="submit"
                      >
                        Procesar documento con IA
                      </button>
                    </form>
                  ) : isXmlDocument(document) ? (
                    <Link
                      className="om7-btn-secondary h-12 px-4"
                      href={`/visor-documento/${document.id}`}
                    >
                      Abrir visor XML
                    </Link>
                  ) : (
                    <span className="block rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-slate-400">
                      No hay una accion automatica disponible para este archivo.
                    </span>
                  )}
                </div>
              </div>
            </section>

            <aside className="rounded-2xl border border-white/[0.08] bg-black/15 p-4">
              <p className="text-sm font-semibold text-white">
                Preview documento
              </p>
              {viewer.signedUrl ? (
                <iframe
                  className="mt-4 h-96 w-full rounded-2xl border border-white/[0.08] bg-black/20"
                  src={viewer.signedUrl}
                  title={document.original_filename ?? "Documento"}
                />
              ) : (
                <p className="mt-4 rounded-xl border border-dashed border-white/[0.1] px-4 py-8 text-center text-sm text-slate-500">
                  Preview no disponible.
                </p>
              )}
            </aside>
          </div>
        </PremiumCard>
      )}
    </ModuleFrame>
  );
}
