import type { ExtractedDocumentData } from "@/lib/document-processing";
import { normalizeCurrencyCode } from "@/lib/currency";

type VisionInput = {
  signedUrl: string;
  filename: string;
  mimeType: string;
};

type NormalizedVisionExtraction = {
  rawText: string;
  extractedData: ExtractedDocumentData;
  confidence: number;
};

type ResponsesApiOutputContent = {
  type?: string;
  text?: string;
};

type ResponsesApiOutput = {
  content?: ResponsesApiOutputContent[];
};

type ResponsesApiResult = {
  output_text?: string;
  output?: ResponsesApiOutput[];
  error?: {
    message?: string;
  };
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    document_kind: { type: "string" },
    supplier_name: { type: "string" },
    supplier_tax_id: { type: "string" },
    customer_name: { type: "string" },
    customer_tax_id: { type: "string" },
    document_number: { type: "string" },
    date: { type: "string" },
    currency: { type: "string" },
    subtotal: { type: "number" },
    tax: { type: "number" },
    total: { type: "number" },
    payment_method: { type: "string" },
    raw_text: { type: "string" },
    confidence: { type: "number" },
    line_items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          codigo: { type: "string" },
          detalle: { type: "string" },
          cantidad: { type: "number" },
          unidad: { type: "string" },
          precio_unitario: { type: "number" },
          monto_total: { type: "number" },
          subtotal: { type: "number" },
          impuesto: { type: "number" },
          total_linea: { type: "number" },
        },
      },
    },
  },
};

function getOpenAiApiKey() {
  return process.env.OPENAI_API_KEY?.trim();
}

function getVisionModel() {
  return process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4.1-mini";
}

function isPdf(mimeType: string, filename: string) {
  return mimeType === "application/pdf" || filename.toLowerCase().endsWith(".pdf");
}

function isImage(mimeType: string) {
  return mimeType.startsWith("image/");
}

async function getPdfFileInput(input: VisionInput) {
  const response = await fetch(input.signedUrl);

  if (!response.ok) {
    throw new Error("No se pudo leer el PDF firmado para procesamiento IA.");
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  return {
    type: "input_file",
    filename: input.filename || "documento.pdf",
    file_data: base64,
  };
}

async function buildVisionContent(input: VisionInput) {
  if (isPdf(input.mimeType, input.filename)) {
    return [await getPdfFileInput(input), getPromptInput()];
  }

  if (isImage(input.mimeType)) {
    return [
      {
        type: "input_image",
        image_url: input.signedUrl,
        detail: "high",
      },
      getPromptInput(),
    ];
  }

  throw new Error("Solo se pueden procesar con IA PDFs e imagenes.");
}

function getPromptInput() {
  return {
    type: "input_text",
    text: [
      "Analiza este documento financiero o contable.",
      "Extrae los datos visibles con la mayor precision posible.",
      "Si un campo no existe o no se puede leer, usa string vacio o 0.",
      "No inventes datos. Mantén moneda ISO cuando sea posible, por ejemplo CRC o USD.",
      "Devuelve solamente JSON valido segun el esquema.",
      "Normaliza fechas como YYYY-MM-DD cuando sea posible.",
      "line_items debe incluir cada linea visible de productos o servicios.",
    ].join("\n"),
  };
}

function getResponseText(result: ResponsesApiResult) {
  if (result.output_text) {
    return result.output_text;
  }

  return (
    result.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? "")
      .join("\n")
      .trim() ?? ""
  );
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function asLineItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => {
    if (!item || typeof item !== "object") {
      return {};
    }

    return item as Record<string, unknown>;
  });
}

export function normalizeVisionExtraction(value: unknown): NormalizedVisionExtraction {
  const data =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const currency = normalizeCurrencyCode(data.currency);
  const extractedData: ExtractedDocumentData = {
    document_kind: asString(data.document_kind),
    supplier_name: asString(data.supplier_name),
    document_number: asString(data.document_number),
    date: asString(data.date),
    currency,
    subtotal: asNumber(data.subtotal),
    tax: asNumber(data.tax),
    total: asNumber(data.total),
    emisor_nombre: asString(data.supplier_name),
    emisor_cedula: asString(data.supplier_tax_id),
    receptor_nombre: asString(data.customer_name),
    receptor_cedula: asString(data.customer_tax_id),
    fecha_emision: asString(data.date),
    numero_consecutivo: asString(data.document_number),
    moneda: currency,
    impuesto: asNumber(data.tax),
    medio_pago: asString(data.payment_method),
    line_items: asLineItems(data.line_items),
  };

  return {
    rawText: asString(data.raw_text),
    extractedData,
    confidence: Math.max(0, Math.min(1, asNumber(data.confidence) || 0.7)),
  };
}

export async function extractDocumentDataWithVision(
  input: VisionInput,
): Promise<NormalizedVisionExtraction> {
  const apiKey = getOpenAiApiKey();

  if (!apiKey) {
    throw new Error("Falta configurar OPENAI_API_KEY.");
  }

  const content = await buildVisionContent(input);
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getVisionModel(),
      input: [
        {
          role: "user",
          content,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "document_extraction",
          schema: EXTRACTION_SCHEMA,
          strict: false,
        },
      },
    }),
  });

  const result = (await response.json()) as ResponsesApiResult;

  if (!response.ok) {
    throw new Error(result.error?.message ?? "OpenAI no pudo procesar el documento.");
  }

  const outputText = getResponseText(result);

  if (!outputText) {
    throw new Error("OpenAI no devolvio datos extraidos.");
  }

  try {
    return normalizeVisionExtraction(JSON.parse(outputText));
  } catch {
    throw new Error("OpenAI devolvio una respuesta no compatible con JSON.");
  }
}
