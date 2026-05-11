import Link from "next/link";
import { notFound } from "next/navigation";
import {
  archiveDocumentAction,
  inactivateDocumentAction,
  processDocumentWithVisionAction,
  restoreDocumentAction,
  softDeleteDocumentAction,
  updateDocumentMetadataAction,
} from "@/app/(platform)/documentos/actions";
import { CounterpartyDetectionCard } from "@/components/documents/counterparty-detection-card";
import { DocumentClassificationCard } from "@/components/documents/document-classification-card";
import { DocumentExtractionWorkspace } from "@/components/documents/document-extraction-workspace";
import {
  BackLink,
  MetricCard,
  ModuleFrame,
  ModuleHeader,
  StatusBadge,
} from "@/components/modules/shared";
import { PremiumCard } from "@/components/ui/premium-card";
import { getCounterpartyMatchByExtraction } from "@/lib/counterparties";
import { getDocumentHumanStatus } from "@/lib/document-ui";
import {
  getActiveCounterpartyRule,
  getDocumentClassificationByExtraction,
} from "@/lib/document-classification";
import { getDocumentViewerData } from "@/lib/storage";

type DocumentWorkspacePageProps = {
  params: Promise<{
    documentId: string;
  }>;
  searchParams?: Promise<{
    error?: string;
    notice?: string;
  }>;
};

const documentTypes = ["factura", "compra", "contrato", "estado_cuenta", "otro"];

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

function getDocumentTitle(
  document: Awaited<ReturnType<typeof getDocumentViewerData>>["document"],
) {
  return document.display_name || document.original_filename || "Documento";
}

function getTags(
  document: Awaited<ReturnType<typeof getDocumentViewerData>>["document"],
) {
  const tags = document.metadata?.tags;

  return Array.isArray(tags) ? tags.map(String).join(", ") : "";
}

function DocumentInfoSection({
  document,
}: {
  document: Awaited<ReturnType<typeof getDocumentViewerData>>["document"];
}) {
  const redirectTo = `/documentos/${document.id}`;
  const archived = Boolean(document.archived_at);
  const inactive = Boolean(document.inactive_at);
  const deleted = Boolean(document.deleted_at);
  const canRestore = archived || inactive || deleted;

  return (
    <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
      <PremiumCard className="p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-base font-semibold text-white">
              Informacion del documento
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Edita datos operativos sin modificar el archivo original.
            </p>
          </div>
          <span className="om7-chip om7-chip-cyan">Editable</span>
        </div>

        <form action={updateDocumentMetadataAction} className="mt-5 space-y-4">
          <input name="documentId" type="hidden" value={document.id} />
          <input name="redirectTo" type="hidden" value={redirectTo} />

          <label className="block rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/80">
              Nombre visible
            </span>
            <input
              className="mt-2 h-11 w-full rounded-xl border border-white/[0.16] bg-white/[0.075] px-3 text-sm font-medium text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/55 focus:bg-white/[0.1] focus:ring-4 focus:ring-cyan-300/15"
              defaultValue={document.display_name ?? ""}
              name="displayName"
              placeholder={document.original_filename ?? "Nombre del documento"}
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/80">
                Tipo documento
              </span>
              <select
                className="mt-2 h-11 w-full rounded-xl border border-white/[0.16] bg-white/[0.075] px-3 text-sm font-medium text-white outline-none transition focus:border-cyan-300/55 focus:bg-white/[0.1] focus:ring-4 focus:ring-cyan-300/15"
                defaultValue={document.document_type}
                name="documentType"
              >
                {documentTypes.map((type) => (
                  <option className="bg-slate-950" key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label className="block rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/80">
                Etiquetas
              </span>
              <input
                className="mt-2 h-11 w-full rounded-xl border border-white/[0.16] bg-white/[0.075] px-3 text-sm font-medium text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/55 focus:bg-white/[0.1] focus:ring-4 focus:ring-cyan-300/15"
                defaultValue={getTags(document)}
                name="tags"
                placeholder="proveedor, urgente, demo"
              />
            </label>
          </div>

          <label className="block rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/80">
              Notas internas
            </span>
            <textarea
              className="mt-2 min-h-28 w-full rounded-xl border border-white/[0.16] bg-white/[0.075] px-3 py-2 text-sm font-medium text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/55 focus:bg-white/[0.1] focus:ring-4 focus:ring-cyan-300/15"
              defaultValue={document.notes ?? ""}
              name="notes"
              placeholder="Notas para el equipo interno."
            />
          </label>

          <button className="om7-btn-primary w-full px-4 sm:w-auto" type="submit">
            Guardar informacion
          </button>
        </form>
      </PremiumCard>

      <PremiumCard className="p-5">
        <p className="text-base font-semibold text-white">Administracion</p>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Acciones de ciclo de vida. No borran fisicamente el archivo original.
        </p>

        <div className="mt-5 space-y-3">
          {!archived && !deleted ? (
            <form action={archiveDocumentAction}>
              <input name="documentId" type="hidden" value={document.id} />
              <input name="redirectTo" type="hidden" value={redirectTo} />
              <button className="om7-btn-secondary w-full px-4" type="submit">
                Archivar
              </button>
            </form>
          ) : null}

          {!inactive && !deleted ? (
            <form action={inactivateDocumentAction}>
              <input name="documentId" type="hidden" value={document.id} />
              <input name="redirectTo" type="hidden" value={redirectTo} />
              <button className="om7-btn-ghost w-full px-4" type="submit">
                Ocultar / inactivar
              </button>
            </form>
          ) : null}

          {canRestore ? (
            <form action={restoreDocumentAction}>
              <input name="documentId" type="hidden" value={document.id} />
              <input name="redirectTo" type="hidden" value={redirectTo} />
              <button className="om7-btn-secondary w-full px-4" type="submit">
                Restaurar
              </button>
            </form>
          ) : null}

          {!deleted ? (
            <form
              action={softDeleteDocumentAction}
              className="rounded-2xl border border-rose-300/15 bg-rose-300/[0.05] p-3"
            >
              <input name="documentId" type="hidden" value={document.id} />
              <input name="redirectTo" type="hidden" value={redirectTo} />
              <label className="flex items-start gap-2 text-xs leading-5 text-rose-100/80">
                <input
                  className="mt-1 h-3.5 w-3.5 rounded border-rose-200/30 bg-black/30"
                  name="confirmDelete"
                  required
                  type="checkbox"
                  value="confirmado"
                />
                Confirmo que quiero marcar este documento como eliminado.
              </label>
              <button
                className="mt-3 inline-grid min-h-11 w-full place-items-center rounded-xl border border-rose-300/30 bg-rose-400/12 px-4 text-sm font-bold text-rose-100 transition hover:bg-rose-400/18"
                type="submit"
              >
                Eliminar
              </button>
            </form>
          ) : null}
        </div>
      </PremiumCard>
    </section>
  );
}

function getWorkflowState(
  document: Awaited<ReturnType<typeof getDocumentViewerData>>["document"],
  extraction: Awaited<ReturnType<typeof getDocumentViewerData>>["extraction"],
) {
  return getDocumentHumanStatus({ ...document, extraction }).label;
}

function DocumentConvertedBanner({
  classification,
  counterpartyMatch,
  document,
}: {
  classification: Awaited<ReturnType<typeof getDocumentClassificationByExtraction>>;
  counterpartyMatch: Awaited<ReturnType<typeof getCounterpartyMatchByExtraction>>;
  document: Awaited<ReturnType<typeof getDocumentViewerData>>["document"];
}) {
  const convertedType =
    document.converted_type ??
    (document.related_type === "purchase" || document.related_type === "invoice"
      ? document.related_type
      : null);

  if (!convertedType) {
    return null;
  }

  const recordLabel = convertedType === "purchase" ? "compra" : "factura";
  const href = convertedType === "purchase" ? "/compras" : "/facturas";

  return (
    <PremiumCard className="border-emerald-300/20 bg-emerald-300/10 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-base font-semibold text-emerald-50">
            Documento convertido
          </p>
          <p className="mt-2 text-sm leading-6 text-emerald-100/75">
            Este documento ya fue convertido en una {recordLabel}
            {document.converted_at ? ` el ${formatDate(document.converted_at)}` : ""}.
            La accion de crear registros queda bloqueada para evitar duplicados.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {counterpartyMatch?.counterparty_id ? (
              <span className="om7-chip border-emerald-300/25 bg-emerald-300/10 text-emerald-100">
                Contraparte asociada: {counterpartyMatch.name || "Detectada"}
              </span>
            ) : null}
            {classification ? (
              <span className="om7-chip om7-chip-cyan">
                Sugerencia OM7:{" "}
                {classification.suggested_category ??
                  classification.suggested_account ??
                  classification.flow_type}
              </span>
            ) : null}
            {classification?.rule_applied ? (
              <span className="om7-chip text-slate-300">
                Regla: {classification.rule_applied}
              </span>
            ) : null}
          </div>
        </div>
        <Link className="om7-btn-secondary px-4 py-2.5" href={href}>
          Ver {recordLabel}
        </Link>
      </div>
    </PremiumCard>
  );
}

export default async function DocumentWorkspacePage({
  params,
  searchParams,
}: DocumentWorkspacePageProps) {
  const { documentId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const actionError = resolvedSearchParams.error ?? null;
  const actionNotice = resolvedSearchParams.notice ?? null;
  const viewer = await getDocumentViewerData(documentId).catch(() => null);

  if (!viewer) {
    notFound();
  }

  const { document, extraction, extractionHistory } = viewer;
  const classification = extraction
    ? await getDocumentClassificationByExtraction(extraction.id)
    : null;
  const counterpartyMatch = extraction
    ? await getCounterpartyMatchByExtraction(extraction.id)
    : null;
  const activeCounterpartyRule = counterpartyMatch?.counterparty_id
    ? await getActiveCounterpartyRule(
        counterpartyMatch.counterparty_id,
        classification?.flow_type,
      )
    : null;
  const state = getWorkflowState(document, extraction);
  const canProcessWithAi = isAiProcessableDocument(document);

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Documento"
        description="Revise el archivo, apruebe los datos y conviertalo en compra o factura."
        action={
          <div className="flex flex-wrap gap-2">
            {extraction ? (
              <Link
                className="om7-btn-secondary px-4 py-2.5"
                href={`/documentos/${document.id}/distribucion`}
              >
                Abrir E7 Mind
              </Link>
            ) : null}
            <BackLink href="/documentos" label="Volver a documentos" />
          </div>
        }
      />

      {actionError ? (
        <PremiumCard className="border-rose-300/20 bg-rose-300/10 p-5">
          <p className="text-base font-semibold text-rose-50">
            No se pudo completar la accion
          </p>
          <p className="mt-2 text-sm leading-6 text-rose-100/80">
            {actionError}
          </p>
        </PremiumCard>
      ) : null}

      {actionNotice ? (
        <PremiumCard className="border-emerald-300/20 bg-emerald-300/10 p-5">
          <p className="text-base font-semibold text-emerald-50">
            Accion completada
          </p>
          <p className="mt-2 text-sm leading-6 text-emerald-100/80">
            {actionNotice}
          </p>
        </PremiumCard>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail={document.original_filename ?? document.id}
          label="Documento"
          value={getDocumentTitle(document)}
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

      <DocumentConvertedBanner
        classification={classification}
        counterpartyMatch={counterpartyMatch}
        document={document}
      />

      <DocumentInfoSection document={document} />

      {extraction ? (
        <>
          <DocumentClassificationCard
            activeCounterpartyRule={activeCounterpartyRule}
            classification={classification}
            counterpartyMatch={counterpartyMatch}
            extractionId={extraction.id}
            redirectTo={`/documentos/${document.id}`}
          />

          <CounterpartyDetectionCard
            extractionId={extraction.id}
            match={counterpartyMatch}
            redirectTo={`/documentos/${document.id}`}
          />

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
              convertedAt={document.converted_at}
              convertedRecordId={document.converted_record_id}
              convertedType={document.converted_type}
              classification={classification}
              signedUrl={viewer.signedUrl}
            />
          </PremiumCard>
        </>
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
