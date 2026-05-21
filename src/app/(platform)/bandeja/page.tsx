import Link from "next/link";
import {
  processDocumentWithVisionAction,
  uploadDocumentAction,
} from "@/app/(platform)/documentos/actions";
import {
  BackLink,
  MetricCard,
  ModuleFrame,
  ModuleHeader,
  StatusBadge,
} from "@/components/modules/shared";
import { PremiumCard } from "@/components/ui/premium-card";
import {
  getReviewStatusBadgeClass,
  getReviewStatusLabel,
} from "@/lib/accounting-review-ui";
import {
  formatConfidence as formatDocumentConfidence,
  getDocumentHumanStatus,
} from "@/lib/document-ui";
import {
  listClientUploadReviewDocuments,
  type ReviewDocument,
} from "@/lib/document-review";

type BandejaPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type FlowKey =
  | "incoming"
  | "needs_review"
  | "ready"
  | "converted"
  | "attention";

const flowLabels: Record<FlowKey, string> = {
  attention: "Atencion",
  converted: "Con salida",
  incoming: "Entrada",
  needs_review: "Revision",
  ready: "Listo",
};

const filterLabels: Record<string, string> = {
  all: "Todos",
  incoming: "Entrada",
  needs_review: "Revision",
  ready: "Listos",
  converted: "Con salida",
  attention: "Atencion",
};

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

function getDocumentKind(document: ReviewDocument) {
  if (isXmlDocument(document)) {
    return "XML";
  }

  if (document.mime_type === "application/pdf") {
    return "PDF";
  }

  if (document.mime_type?.startsWith("image/")) {
    return "Imagen";
  }

  return "Documento";
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
    return "attention";
  }

  if (document.extraction?.extraction_status === "reviewed") {
    return "ready";
  }

  if (
    document.extraction?.extraction_status === "processed" ||
    document.processing_status === "completed"
  ) {
    return "needs_review";
  }

  return "incoming";
}

function getHumanState(document: ReviewDocument) {
  const flowState = getFlowState(document);

  if (flowState === "converted") {
    return document.converted_type === "purchase"
      ? "Compra creada"
      : "Factura creada";
  }

  if (flowState === "attention") {
    return "Requiere atencion";
  }

  if (flowState === "ready") {
    return "Listo para salida";
  }

  if (flowState === "needs_review") {
    return "Pendiente de clasificar";
  }

  return getDocumentHumanStatus(document).label;
}

function matchesFilter(document: ReviewDocument, filter: string) {
  if (filter === "all") {
    return true;
  }

  return getFlowState(document) === filter;
}

function getClassificationLabel(document: ReviewDocument) {
  const classification = document.classification;

  if (!classification) {
    return document.review_status === "approved"
      ? "Revision aprobada"
      : "Sin clasificacion";
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

function getDestination(document: ReviewDocument) {
  if (document.converted_type === "purchase") {
    return {
      href: "/compras",
      label: "Continuar en Compras",
      short: "Compra",
    };
  }

  if (document.converted_type === "invoice") {
    return {
      href: "/facturas",
      label: "Continuar en Facturas",
      short: "Venta",
    };
  }

  return null;
}

function getPrimaryAction(document: ReviewDocument) {
  const flowState = getFlowState(document);

  if (flowState === "converted") {
    return getDestination(document);
  }

  if (flowState === "ready") {
    return {
      href: `/documentos/${document.id}`,
      label: "Dar salida",
      short: "Salida",
    };
  }

  if (flowState === "needs_review") {
    return {
      href: `/documentos/${document.id}`,
      label: "Clasificar",
      short: "Clasificar",
    };
  }

  return {
    href: `/documentos/${document.id}`,
    label: flowState === "attention" ? "Resolver" : "Procesar",
    short: flowState === "attention" ? "Resolver" : "Procesar",
  };
}

function getShortReviewNote(document: ReviewDocument) {
  const note =
    document.convertedRecord?.review_notes?.trim() ||
    document.review_notes?.trim();

  if (!note) {
    return null;
  }

  return note.length > 110 ? `${note.slice(0, 110)}...` : note;
}

function FlowDot({ active }: { active: boolean }) {
  return (
    <span
      className={[
        "h-2.5 w-2.5 rounded-full border",
        active
          ? "border-cyan-200 bg-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.55)]"
          : "border-white/[0.12] bg-white/[0.05]",
      ].join(" ")}
    />
  );
}

function WorkflowRow({ document }: { document: ReviewDocument }) {
  const extraction = document.extraction;
  const confidence =
    document.classification?.confidence_score ?? extraction?.confidence ?? null;
  const destination = getDestination(document);
  const primaryAction = getPrimaryAction(document);
  const flowState = getFlowState(document);
  const reviewNote = getShortReviewNote(document);

  return (
    <article className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 shadow-lg shadow-black/10 transition hover:border-cyan-300/25 hover:bg-white/[0.045]">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.95fr)_minmax(180px,auto)] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge>{getHumanState(document)}</StatusBadge>
            <span className="om7-chip text-slate-400">
              {getDocumentKind(document)}
            </span>
            <span className="om7-chip om7-chip-cyan">
              {flowLabels[flowState]}
            </span>
            {document.converted_type ? (
              <span
                className={getReviewStatusBadgeClass(
                  document.convertedRecord?.review_status,
                )}
              >
                {getReviewStatusLabel(document.convertedRecord?.review_status)}
              </span>
            ) : null}
          </div>

          <p className="mt-3 truncate text-sm font-semibold text-white">
            {document.display_name || document.original_filename || "Documento"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {document.document_type} - ingresado {formatDate(document.created_at)}
          </p>
          {reviewNote ? (
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-amber-100/80">
              Nota: {reviewNote}
            </p>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="min-w-0 rounded-xl border border-white/[0.07] bg-black/15 p-3">
            <p className="text-xs text-slate-500">Contraparte</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-100">
              {getCounterpartyLabel(document)}
            </p>
          </div>
          <div className="min-w-0 rounded-xl border border-white/[0.07] bg-black/15 p-3">
            <p className="text-xs text-slate-500">Clasificacion</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-100">
              {getClassificationLabel(document)}
            </p>
          </div>
          <div className="min-w-0 rounded-xl border border-white/[0.07] bg-black/15 p-3">
            <p className="text-xs text-slate-500">Confianza</p>
            <p className="mt-1 truncate text-sm font-semibold text-cyan-50">
              {formatDocumentConfidence(confidence)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {flowState === "incoming" && isAiProcessableDocument(document) ? (
            <form action={processDocumentWithVisionAction}>
              <input name="redirectTo" type="hidden" value="/bandeja" />
              <input name="documentId" type="hidden" value={document.id} />
              <button className="om7-btn-primary h-10 px-4 text-xs" type="submit">
                Procesar con IA
              </button>
            </form>
          ) : (
            <Link className="om7-btn-primary h-10 px-4 text-xs" href={primaryAction?.href ?? `/documentos/${document.id}`}>
              {primaryAction?.label ?? "Procesar"}
            </Link>
          )}
          {destination ? (
            <Link className="om7-btn-ghost h-10 px-4 text-xs" href={`/documentos/${document.id}`}>
              Ver origen
            </Link>
          ) : (
            <Link className="om7-btn-ghost h-10 px-4 text-xs" href="/documentos">
              Consulta
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function UploadPanel({ disabled }: { disabled: boolean }) {
  return (
    <details className="group relative">
      <summary className="om7-btn-primary flex h-11 cursor-pointer list-none items-center px-4 text-sm">
        Ingresar documento
      </summary>
      <div className="absolute right-0 top-12 z-20 w-[min(92vw,420px)] rounded-3xl border border-cyan-300/15 bg-slate-950/95 p-4 shadow-2xl shadow-black/45 backdrop-blur-xl">
        <p className="text-sm font-semibold text-white">Enviar a Bandeja</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          El archivo entra como documento pendiente y se clasifica desde esta
          estacion.
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
            className="h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
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
            className="om7-btn-secondary flex h-11 w-full items-center justify-center px-4 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled}
            type="submit"
          >
            Subir y dejar pendiente
          </button>
        </form>
      </div>
    </details>
  );
}

export default async function ReviewInboxPage({
  searchParams,
}: BandejaPageProps) {
  const params = (await searchParams) ?? {};
  const activeFilter = getParam(params, "filter") ?? "all";
  const actionError = getParam(params, "error") ?? null;
  const actionNotice = getParam(params, "notice") ?? null;
  const { activeContext, documents } = await listClientUploadReviewDocuments();
  const activeCompany = activeContext.activeCompany;
  const visibleDocuments = documents.filter((document) =>
    matchesFilter(document, activeFilter),
  );
  const counts = {
    attention: documents.filter((document) => getFlowState(document) === "attention").length,
    converted: documents.filter((document) => getFlowState(document) === "converted").length,
    incoming: documents.filter((document) => getFlowState(document) === "incoming").length,
    needs_review: documents.filter((document) => getFlowState(document) === "needs_review").length,
    ready: documents.filter((document) => getFlowState(document) === "ready").length,
  };

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Bandeja diaria"
        description="Puerta de entrada: reciba, clasifique y de salida a Compra, Venta u Otro."
        action={<BackLink />}
      />

      <div className="sticky top-3 z-20 rounded-3xl border border-white/[0.08] bg-slate-950/88 p-3 shadow-2xl shadow-black/25 backdrop-blur-xl">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100">
              Empresa: {activeCompany?.name ?? "sin empresa"}
            </span>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <FlowDot active />
              Entrada
              <FlowDot active={counts.needs_review + counts.ready + counts.converted > 0} />
              Clasificacion
              <FlowDot active={counts.converted > 0} />
              Salida
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <UploadPanel disabled={!activeCompany} />
            <Link className="om7-btn-ghost h-11 px-4 text-sm" href="/documentos">
              Consulta de documentos
            </Link>
          </div>
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          detail="Pendientes de entrada"
          label="Entrada"
          value={String(counts.incoming)}
        />
        <MetricCard
          detail="Datos extraidos"
          label="Por clasificar"
          value={String(counts.needs_review)}
        />
        <MetricCard
          detail="Aprobados para salida"
          label="Listos"
          value={String(counts.ready)}
        />
        <MetricCard
          detail="Compra o venta creada"
          label="Con salida"
          value={String(counts.converted)}
        />
        <MetricCard
          detail="Observados o fallidos"
          label="Atencion"
          value={String(counts.attention)}
        />
      </section>

      <PremiumCard className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-base font-semibold text-white">
              Estacion de clasificacion
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Cada fila debe terminar con una salida clara: Compra, Venta u
              Otro. Luego el seguimiento continua en el modulo correspondiente.
            </p>
          </div>
          <span className="text-sm text-slate-500">
            {visibleDocuments.length} de {documents.length} visibles
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {Object.entries(filterLabels).map(([filter, label]) => {
            const count =
              filter === "all" ? documents.length : counts[filter as FlowKey];

            return (
              <Link
                className={[
                  "rounded-full border px-3 py-2 text-xs font-semibold transition",
                  activeFilter === filter
                    ? "border-cyan-300/30 bg-cyan-300/12 text-cyan-100"
                    : "border-white/[0.08] bg-white/[0.04] text-slate-400 hover:text-white",
                ].join(" ")}
                href={`/bandeja?filter=${filter}`}
                key={filter}
              >
                {label} - {count}
              </Link>
            );
          })}
        </div>

        <div className="mt-5 max-h-[62vh] space-y-3 overflow-y-auto pr-1">
          {visibleDocuments.length > 0 ? (
            visibleDocuments.map((document) => (
              <WorkflowRow document={document} key={document.id} />
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/[0.1] bg-black/10 p-8 text-center text-sm leading-6 text-slate-500">
              No hay documentos en este estado.
            </div>
          )}
        </div>
      </PremiumCard>
    </ModuleFrame>
  );
}
