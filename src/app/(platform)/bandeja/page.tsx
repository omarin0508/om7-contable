import Link from "next/link";
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

type LaneKey = "received" | "processed" | "review" | "converted" | "error";

const filterLabels: Record<string, string> = {
  all: "Todos",
  pending: "Pendientes",
  processed: "Procesados",
  review: "Listos para revisar",
  converted: "Convertidos",
  error: "Con error",
};

const laneLabels: Record<LaneKey, string> = {
  converted: "Convertido",
  error: "Requiere atencion",
  processed: "Procesado",
  received: "Recibido",
  review: "Listo para revisar",
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

function getDocumentLane(document: ReviewDocument): LaneKey {
  if (document.converted_type || document.converted_at) {
    return "converted";
  }

  if (
    document.processing_status === "error" ||
    document.review_status === "rejected" ||
    document.extraction?.extraction_status === "error"
  ) {
    return "error";
  }

  if (document.extraction?.extraction_status === "reviewed") {
    return "review";
  }

  if (document.extraction?.extraction_status === "processed") {
    return "processed";
  }

  return "received";
}

function getHumanState(document: ReviewDocument) {
  return getDocumentHumanStatus(document).label;
}

function matchesFilter(document: ReviewDocument, filter: string) {
  const lane = getDocumentLane(document);

  if (filter === "pending") {
    return lane === "received";
  }

  if (filter === "processed") {
    return lane === "processed";
  }

  if (filter === "review") {
    return lane === "review";
  }

  if (filter === "converted") {
    return lane === "converted";
  }

  if (filter === "error") {
    return lane === "error";
  }

  return true;
}

function getClassificationLabel(document: ReviewDocument) {
  const classification = document.classification;

  if (!classification) {
    return "Sin clasificacion";
  }

  return (
    classification.suggested_category ||
    classification.suggested_account ||
    classification.flow_type
  );
}

function getCounterpartyLabel(document: ReviewDocument) {
  return document.counterpartyMatch?.name || "Sin contraparte";
}

function getRegisterHref(document: ReviewDocument) {
  if (document.converted_type === "purchase") {
    return "/compras";
  }

  if (document.converted_type === "invoice") {
    return "/facturas";
  }

  return null;
}

function getConversionReviewLabel(document: ReviewDocument) {
  if (!document.converted_type) {
    return null;
  }

  const conversionLabel =
    document.converted_type === "purchase"
      ? "Convertido a compra"
      : "Convertido a factura";

  return `${conversionLabel} · ${getReviewStatusLabel(
    document.convertedRecord?.review_status,
  )}`;
}

function getShortReviewNote(document: ReviewDocument) {
  const note = document.convertedRecord?.review_notes?.trim();

  if (!note) {
    return null;
  }

  return note.length > 96 ? `${note.slice(0, 96)}...` : note;
}

function WorkflowCard({ document }: { document: ReviewDocument }) {
  const extraction = document.extraction;
  const registerHref = getRegisterHref(document);
  const confidence =
    document.classification?.confidence_score ?? extraction?.confidence ?? null;
  const conversionReviewLabel = getConversionReviewLabel(document);
  const reviewNote = getShortReviewNote(document);

  return (
    <article className="rounded-3xl border border-white/[0.08] bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.07),transparent_34%),rgba(255,255,255,0.035)] p-4 shadow-2xl shadow-black/10 transition hover:border-cyan-300/20 hover:bg-white/[0.05]">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge>{getHumanState(document)}</StatusBadge>
          <span className="om7-chip text-slate-400">
            {getDocumentKind(document)}
          </span>
          {extraction?.extraction_provider ? (
            <span className="om7-chip om7-chip-cyan">
              {extraction.extraction_provider}
            </span>
          ) : null}
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

        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-semibold leading-5 text-white">
            {document.display_name || document.original_filename || "Documento"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {document.document_type} · cargado {formatDate(document.created_at)}
          </p>
          {conversionReviewLabel ? (
            <p className="mt-2 text-xs font-semibold text-cyan-100">
              {conversionReviewLabel}
            </p>
          ) : null}
          {reviewNote ? (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-amber-100/80">
              Observacion: {reviewNote}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-3">
            <p className="text-xs text-slate-500">Contraparte</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-100">
              {getCounterpartyLabel(document)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-3">
            <p className="text-xs text-slate-500">Sugerencia OM7</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-100">
              {getClassificationLabel(document)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-3">
            <p className="text-xs text-slate-500">Confianza</p>
            <p className="mt-1 text-sm font-semibold text-cyan-50">
              {formatDocumentConfidence(confidence)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            className="om7-btn-primary px-4 py-2.5"
            href={`/documentos/${document.id}`}
          >
            Abrir workspace
          </Link>
          {registerHref ? (
            <Link className="om7-btn-ghost px-4 py-2.5" href={registerHref}>
              Ver {document.converted_type === "purchase" ? "compra" : "factura"}
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default async function ReviewInboxPage({
  searchParams,
}: BandejaPageProps) {
  const params = (await searchParams) ?? {};
  const activeFilter = getParam(params, "filter") ?? "all";
  const actionError = getParam(params, "error") ?? null;
  const { activeContext, documents } = await listClientUploadReviewDocuments();
  const activeCompany = activeContext.activeCompany;
  const visibleDocuments = documents.filter((document) =>
    matchesFilter(document, activeFilter),
  );
  const pendingCount = documents.filter(
    (document) => getDocumentLane(document) === "received",
  ).length;
  const processedCount = documents.filter(
    (document) => getDocumentLane(document) === "processed",
  ).length;
  const reviewCount = documents.filter(
    (document) => getDocumentLane(document) === "review",
  ).length;
  const convertedDocuments = documents.filter(
    (document) => getDocumentLane(document) === "converted",
  );
  const today = new Date().toISOString().slice(0, 10);
  const convertedTodayCount = convertedDocuments.filter((document) =>
    document.converted_at?.startsWith(today),
  ).length;
  const lanes: LaneKey[] = [
    "received",
    "processed",
    "review",
    "converted",
    "error",
  ];

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Bandeja operativa"
        description="La cola diaria para revisar documentos de clientes y convertirlos en registros contables."
        action={<BackLink />}
      />

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
          label="Documentos pendientes"
          value={String(pendingCount)}
        />
        <MetricCard
          detail="Extraidos por XML/IA"
          label="Procesados"
          value={String(processedCount)}
        />
        <MetricCard
          detail="Listos para convertir"
          label="Listos para revisar"
          value={String(reviewCount)}
        />
        <MetricCard
          detail={`Hoy ${convertedTodayCount} · total ${convertedDocuments.length}`}
          label="Convertidos"
          value={String(convertedDocuments.length)}
        />
      </section>

      <PremiumCard className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-base font-semibold text-white">
              Trabajo diario
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Cliente sube documento, OM7 procesa, el contador revisa y el
              registro queda trazado.
            </p>
          </div>
          <span className="text-sm text-slate-500">
            {visibleDocuments.length} de {documents.length} visibles
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {Object.entries(filterLabels).map(([filter, label]) => (
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
              {label}
            </Link>
          ))}
          {activeCompany ? (
            <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100">
              Empresa: {activeCompany.name}
            </span>
          ) : null}
        </div>
      </PremiumCard>

      <section className="grid gap-4 xl:grid-cols-5">
        {lanes.map((lane) => {
          const laneDocuments = visibleDocuments.filter(
            (document) => getDocumentLane(document) === lane,
          );

          return (
            <section
              className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-3"
              key={lane}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <p className="text-sm font-semibold text-white">
                  {laneLabels[lane]}
                </p>
                <span className="rounded-full border border-white/[0.08] bg-black/20 px-2 py-1 text-xs text-slate-400">
                  {laneDocuments.length}
                </span>
              </div>

              <div className="space-y-3 pr-0 xl:max-h-[68vh] xl:overflow-y-auto xl:overscroll-contain xl:pr-1">
                {laneDocuments.length > 0 ? (
                  laneDocuments.map((document) => (
                    <WorkflowCard document={document} key={document.id} />
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/[0.1] bg-black/10 p-4 text-center text-xs leading-5 text-slate-500">
                    Sin documentos en este estado.
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </section>
    </ModuleFrame>
  );
}
