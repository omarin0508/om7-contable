export type AccountingReviewStatus =
  | "pending"
  | "reviewed"
  | "approved"
  | "observed";

const reviewStatuses = new Set<AccountingReviewStatus>([
  "pending",
  "reviewed",
  "approved",
  "observed",
]);

export function normalizeReviewStatus(
  status: string | null | undefined,
): AccountingReviewStatus {
  return reviewStatuses.has(status as AccountingReviewStatus)
    ? (status as AccountingReviewStatus)
    : "pending";
}

export function getReviewStatusLabel(status: string | null | undefined) {
  const normalized = normalizeReviewStatus(status);

  const labels: Record<AccountingReviewStatus, string> = {
    approved: "Aprobado",
    observed: "Observado",
    pending: "Pendiente",
    reviewed: "Revisado",
  };

  return labels[normalized];
}

export function getReviewStatusBadgeClass(status: string | null | undefined) {
  const normalized = normalizeReviewStatus(status);

  const classes: Record<AccountingReviewStatus, string> = {
    approved: "om7-chip om7-chip-emerald",
    observed: "om7-chip om7-chip-rose",
    pending: "om7-chip om7-chip-amber",
    reviewed: "om7-chip om7-chip-cyan",
  };

  return classes[normalized];
}

export function getReviewStatusDescription(
  status: string | null | undefined,
) {
  const normalized = normalizeReviewStatus(status);

  const descriptions: Record<AccountingReviewStatus, string> = {
    approved: "Registro validado para cierre contable.",
    observed: "Registro con observaciones pendientes de resolver.",
    pending: "Registro creado, pendiente de revision contable.",
    reviewed: "Registro revisado por el equipo contable.",
  };

  return descriptions[normalized];
}
