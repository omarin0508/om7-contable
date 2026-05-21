export type DocumentHumanStatusKey =
  | "convertido"
  | "error"
  | "observado"
  | "procesado"
  | "recibido"
  | "requiere_revision";

export type DocumentUiLike = {
  converted_at?: string | null;
  converted_type?: "purchase" | "invoice" | string | null;
  processing_status?: string | null;
  related_type?: string | null;
  review_status?: string | null;
  extraction?: {
    extraction_status?: string | null;
  } | null;
};

export function getConversionLabel(document: DocumentUiLike) {
  const convertedType =
    document.converted_type ??
    (document.related_type === "purchase" || document.related_type === "invoice"
      ? document.related_type
      : null);

  if (convertedType === "purchase") {
    return "Convertido a compra";
  }

  if (convertedType === "invoice") {
    return "Convertido a factura";
  }

  return null;
}

export function getDocumentHumanStatus(document: DocumentUiLike): {
  key: DocumentHumanStatusKey;
  label: string;
} {
  const conversionLabel = getConversionLabel(document);

  if (conversionLabel || document.converted_at) {
    return {
      key: "convertido",
      label: conversionLabel ?? "Convertido",
    };
  }

  if (
    document.processing_status === "error" ||
    document.extraction?.extraction_status === "error"
  ) {
    return {
      key: "error",
      label: "Error / requiere atención",
    };
  }

  if (document.review_status === "observed") {
    return {
      key: "observado",
      label: "Observado",
    };
  }

  if (document.review_status === "rejected") {
    return {
      key: "error",
      label: "Error / requiere atención",
    };
  }

  if (document.extraction?.extraction_status === "reviewed") {
    return {
      key: "requiere_revision",
      label: "Listo para convertir",
    };
  }

  if (document.extraction?.extraction_status === "processed") {
    return {
      key: "requiere_revision",
      label: "Requiere revisión",
    };
  }

  if (document.processing_status === "processing") {
    return {
      key: "procesado",
      label: "Procesando",
    };
  }

  return {
    key: "recibido",
    label: "Recibido",
  };
}

export function getDocumentWorkflowLabel(document: DocumentUiLike) {
  return getDocumentHumanStatus(document).label;
}

export function getConfidenceLabel(value: number | null | undefined) {
  const confidence = Number(value ?? 0);
  const normalized = confidence > 1 ? confidence / 100 : confidence;

  if (normalized >= 0.9) {
    return "Alta";
  }

  if (normalized >= 0.65) {
    return "Media";
  }

  return "Revisión recomendada";
}

export function formatConfidence(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "Sin confianza";
  }

  const confidence = Number(value);
  const normalized = confidence > 1 ? confidence : confidence * 100;

  if (!Number.isFinite(normalized)) {
    return "Sin confianza";
  }

  return `${Math.round(normalized)}%`;
}

export function getConversionMetadataValue(
  metadata: unknown,
  key: string,
  fallback = "No disponible",
) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return fallback;
  }

  const value = (metadata as Record<string, unknown>)[key];

  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
}

export function getConversionMetadataObject(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  return metadata as Record<string, unknown>;
}

export function getConversionMetadataString(metadata: unknown, key: string) {
  const metadataObject = getConversionMetadataObject(metadata);
  const value = metadataObject?.[key];

  return typeof value === "string" && value.trim() ? value : null;
}

export function hasE7MindTrace(metadata: unknown) {
  const metadataObject = getConversionMetadataObject(metadata);

  if (!metadataObject) {
    return false;
  }

  return (
    metadataObject.created_from === "e7_mind_distribution" ||
    Boolean(metadataObject.e7_mind) ||
    Boolean(metadataObject.distribution_id) ||
    Boolean(metadataObject.distribution_line_ids)
  );
}
