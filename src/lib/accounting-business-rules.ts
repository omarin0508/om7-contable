import {
  normalizeReviewStatus,
  type AccountingReviewStatus,
} from "@/lib/accounting-review-ui";
import { normalizePeriodStatus } from "@/lib/accounting-periods";

export type AccountingRecordLike = {
  review_status?: string | null;
};

export type AccountingPeriodLike = {
  status?: string | null;
} | null;

export function isRecordLockedByPeriod(period: AccountingPeriodLike) {
  return normalizePeriodStatus(period?.status) === "closed";
}

export function canEditRecord(
  record: AccountingRecordLike,
  period: AccountingPeriodLike,
) {
  if (isRecordLockedByPeriod(period)) {
    return false;
  }

  const status = normalizeReviewStatus(record.review_status);

  return status === "pending" || status === "reviewed" || status === "observed";
}

export function canReviewRecord(
  record: AccountingRecordLike,
  period: AccountingPeriodLike,
) {
  if (isRecordLockedByPeriod(period)) {
    return false;
  }

  return normalizeReviewStatus(record.review_status) !== "approved";
}

export function canApproveRecord(
  record: AccountingRecordLike,
  period: AccountingPeriodLike,
) {
  if (isRecordLockedByPeriod(period)) {
    return false;
  }

  const status = normalizeReviewStatus(record.review_status);

  return status === "pending" || status === "reviewed";
}

export function canObserveRecord(
  record: AccountingRecordLike,
  period: AccountingPeriodLike,
) {
  if (isRecordLockedByPeriod(period)) {
    return false;
  }

  return normalizeReviewStatus(record.review_status) !== "approved";
}

export function canReopenReview(
  record: AccountingRecordLike,
  period: AccountingPeriodLike,
) {
  if (isRecordLockedByPeriod(period)) {
    return false;
  }

  const status = normalizeReviewStatus(record.review_status);

  return status === "reviewed" || status === "approved";
}

export function getRecordBusinessStateLabel(
  record: AccountingRecordLike,
  period: AccountingPeriodLike,
) {
  if (isRecordLockedByPeriod(period)) {
    return "Periodo cerrado";
  }

  const status = normalizeReviewStatus(record.review_status);
  const labels: Record<AccountingReviewStatus, string> = {
    approved: "Aprobado",
    observed: "Tiene observaciones",
    pending: "Por revisar",
    reviewed: "Corregido",
  };

  return labels[status];
}

export function getRecordBusinessStateDescription(
  record: AccountingRecordLike,
  period: AccountingPeriodLike,
) {
  if (isRecordLockedByPeriod(period)) {
    return "Este registro pertenece a un mes cerrado. Mantengalo como solo lectura.";
  }

  const status = normalizeReviewStatus(record.review_status);
  const descriptions: Record<AccountingReviewStatus, string> = {
    approved: "Registro aprobado para cierre.",
    observed: "Corrija la observacion y marque como corregido.",
    pending: "Falta revisar este registro.",
    reviewed: "Registro corregido/revisado; puede aprobarse.",
  };

  return descriptions[status];
}
