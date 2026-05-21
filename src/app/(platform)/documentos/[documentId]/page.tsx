import Link from "next/link";
import { notFound } from "next/navigation";
import {
  archiveDocumentAction,
  initializeDocumentClassificationAction,
  inactivateDocumentAction,
  processDocumentAction,
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

const documentTypes = [
  "factura",
  "venta",
  "compra",
  "contrato",
  "estado_cuenta",
  "otro",
];

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
              Datos de consulta
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Informacion secundaria para busqueda y trazabilidad.
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
                Tipo recibido
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
                Palabras clave
              </span>
              <input
                className="mt-2 h-11 w-full rounded-xl border border-white/[0.16] bg-white/[0.075] px-3 text-sm font-medium text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/55 focus:bg-white/[0.1] focus:ring-4 focus:ring-cyan-300/15"
                defaultValue={getTags(document)}
                name="tags"
                placeholder="proveedor, proyecto, urgencia"
              />
            </label>
          </div>

          <label className="block rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/80">
              Nota de consulta
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
          <p className="text-base font-semibold text-white">Ciclo de vida</p>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Acciones secundarias para ordenar la consulta documental.
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
            Salida creada
          </p>
          <p className="mt-2 text-sm leading-6 text-emerald-100/75">
            Este documento ya salio de Bandeja como {recordLabel}
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
                Clasificacion:{" "}
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
          Continuar en {convertedType === "purchase" ? "Compras" : "Facturas"}
        </Link>
      </div>
    </PremiumCard>
  );
}

function PendingExtractionWorkspace({
  document,
  signedUrl,
}: {
  document: Awaited<ReturnType<typeof getDocumentViewerData>>["document"];
  signedUrl: string | null;
}) {
  const canProcessWithAi = isAiProcessableDocument(document);
  const canOpenXml = isXmlDocument(document);
  const redirectTo = `/documentos/${document.id}`;

  return (
    <PremiumCard className="p-5">
      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {["Entrada", "Preparar datos", "Clasificar", "Salida"].map(
              (step, index) => (
                <span
                  className={[
                    "rounded-2xl border px-3 py-2 text-center text-xs font-semibold",
                    index <= 1
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

          <div className="rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.045] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge>Pendiente de datos</StatusBadge>
              <span className="om7-chip text-slate-300">
                {document.document_type}
              </span>
            </div>
            <p className="mt-4 text-lg font-semibold text-white">
              {document.original_filename ?? "Documento"}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Para clasificar y dar salida primero necesitamos datos revisables:
              XML interpretado, IA sobre PDF/imagen o una captura manual.
            </p>
          </div>

          <div className="grid gap-3">
            {canProcessWithAi ? (
              <form
                action={processDocumentWithVisionAction}
                className="rounded-2xl border border-white/[0.08] bg-black/15 p-4"
              >
                <input name="redirectTo" type="hidden" value={redirectTo} />
                <input name="documentId" type="hidden" value={document.id} />
                <p className="text-sm font-semibold text-white">
                  Procesar PDF/imagen con IA
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Extrae proveedor, fecha, consecutivo, totales y lineas para
                  habilitar revision y clasificacion.
                </p>
                <button className="om7-btn-primary mt-4 h-11 px-4" type="submit">
                  Procesar con IA
                </button>
              </form>
            ) : null}

            {canOpenXml ? (
              <div className="rounded-2xl border border-white/[0.08] bg-black/15 p-4">
                <p className="text-sm font-semibold text-white">
                  Interpretar XML
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Abra el visor del XML para leer la factura electronica y
                  preparar los datos de revision.
                </p>
                <Link
                  className="om7-btn-secondary mt-4 h-11 px-4"
                  href={`/visor-documento/${document.id}`}
                >
                  Abrir visor XML
                </Link>
              </div>
            ) : null}

            <form
              action={initializeDocumentClassificationAction}
              className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.07] p-4"
            >
              <input name="redirectTo" type="hidden" value={redirectTo} />
              <input name="documentId" type="hidden" value={document.id} />
              <p className="text-sm font-semibold text-white">
                Clasificar manualmente ahora
              </p>
              <p className="mt-1 text-xs leading-5 text-emerald-100/75">
                Crea una revision base y abre la clasificacion de salida para
                elegir Compra, Venta u Otro.
              </p>
              <button className="om7-btn-primary mt-4 h-11 px-4" type="submit">
                Clasificar salida
              </button>
            </form>

            <details className="rounded-2xl border border-white/[0.08] bg-black/15 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-200">
                Crear solo revision manual
              </summary>
              <form action={processDocumentAction} className="mt-4">
                <input name="redirectTo" type="hidden" value={redirectTo} />
                <input name="documentId" type="hidden" value={document.id} />
                <input
                  name="rawText"
                  type="hidden"
                  value="Extraccion manual creada desde Bandeja para revision."
                />
                <p className="text-xs leading-5 text-slate-500">
                  Use esto si primero quiere revisar datos antes de generar la
                  clasificacion.
                </p>
                <button className="om7-btn-ghost mt-3 h-11 px-4" type="submit">
                  Crear revision
                </button>
              </form>
            </details>
          </div>
        </section>

        <aside className="rounded-2xl border border-white/[0.08] bg-black/15 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">
              Evidencia original
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
          {signedUrl ? (
            <iframe
              className="mt-4 h-96 w-full rounded-2xl border border-white/[0.08] bg-black/20"
              src={signedUrl}
              title={document.original_filename ?? "Documento"}
            />
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-white/[0.1] px-4 py-8 text-center text-sm text-slate-500">
              Preview no disponible. El flujo puede continuar con revision
              manual.
            </p>
          )}
        </aside>
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
  return (
    <ModuleFrame>
      <ModuleHeader
        title="Clasificar documento"
        description="Revise datos, confirme salida y continue el flujo en Compras o Facturas."
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
            <BackLink href="/bandeja" label="Volver a bandeja" />
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
          label="Fuente"
          value={getDocumentTitle(document)}
        />
        <MetricCard
          detail={document.mime_type ?? "Sin MIME"}
          label="Estado bandeja"
          value={state}
        />
        <MetricCard
          detail={extraction?.extraction_provider ?? "Sin extraccion"}
          label="Extraccion"
          value={extraction ? "Detectado" : "Pendiente"}
        />
        <MetricCard
          detail={formatDate(document.created_at)}
          label="Entrada"
          value={extraction?.confidence ? String(extraction.confidence) : "N/D"}
        />
      </section>

      <DocumentConvertedBanner
        classification={classification}
        counterpartyMatch={counterpartyMatch}
        document={document}
      />

      {extraction ? (
        <>
          <DocumentClassificationCard
            activeCounterpartyRule={activeCounterpartyRule}
            classification={classification}
            counterpartyMatch={counterpartyMatch}
            extractionId={extraction.id}
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

          <CounterpartyDetectionCard
            extractionId={extraction.id}
            match={counterpartyMatch}
            redirectTo={`/documentos/${document.id}`}
          />
        </>
      ) : (
        <PendingExtractionWorkspace document={document} signedUrl={viewer.signedUrl} />
      )}

      <details className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-200">
          Opciones de consulta y archivo
        </summary>
        <div className="mt-4">
          <DocumentInfoSection document={document} />
        </div>
      </details>
    </ModuleFrame>
  );
}
