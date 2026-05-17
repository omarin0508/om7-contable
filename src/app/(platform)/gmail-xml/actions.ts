"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  formatGmailXmlSyncNotice,
  getGmailConnectUrl,
  type GmailXmlRunOptions,
  normalizeGmailXmlLimit,
  syncGmailXmlAttachments,
  testGmailConnection,
} from "@/lib/gmail-xml-import";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function logGmailXmlActionError(action: string, error: unknown) {
  console.error("[OM7 Gmail XML action error]", {
    action,
    error: error instanceof Error ? error.message : String(error),
  });
}

function redirectWithParam(path: string, key: "error" | "notice", message: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(message)}`;
}

export async function connectGmailXmlAction() {
  let target = "";

  try {
    target = await getGmailConnectUrl();
  } catch (error) {
    logGmailXmlActionError("connectGmailXmlAction", error);
    target = redirectWithParam(
      "/gmail-xml",
      "error",
      getErrorMessage(error, "No se pudo iniciar la conexion Gmail."),
    );
  }

  redirect(target);
}

export async function testGmailXmlConnectionAction() {
  let target = "/gmail-xml";

  try {
    const email = await testGmailConnection();
    target = redirectWithParam(
      "/gmail-xml",
      "notice",
      `Conexion Gmail correcta para ${email}.`,
    );
  } catch (error) {
    logGmailXmlActionError("testGmailXmlConnectionAction", error);
    target = redirectWithParam(
      "/gmail-xml",
      "error",
      getErrorMessage(error, "No se pudo probar Gmail."),
    );
  }

  revalidatePath("/gmail-xml");
  redirect(target);
}

function getFormLimit(formData?: FormData) {
  return normalizeGmailXmlLimit(formData?.get("limit"));
}

function getFormValue(formData: FormData | undefined, key: string) {
  return String(formData?.get(key) ?? "").trim();
}

function getRunOptions(formData?: FormData): GmailXmlRunOptions {
  const mode = getFormValue(formData, "mode") === "historical"
    ? "historical"
    : "daily";

  return {
    mode,
    dateFrom: getFormValue(formData, "dateFrom") || null,
    dateTo: getFormValue(formData, "dateTo") || null,
    batchPeriod: getFormValue(formData, "batchPeriod") || null,
  };
}

function buildGmailXmlPath(options: GmailXmlRunOptions, limit: number, list = true) {
  const search = new URLSearchParams({
    mode: options.mode ?? "daily",
    limit: String(limit),
  });

  if (list) {
    search.set("list", "xml");
  }

  if (options.dateFrom) {
    search.set("dateFrom", options.dateFrom);
  }

  if (options.dateTo) {
    search.set("dateTo", options.dateTo);
  }

  if (options.batchPeriod) {
    search.set("batchPeriod", options.batchPeriod);
  }

  return `/gmail-xml?${search.toString()}`;
}

export async function listGmailXmlMessagesAction(formData?: FormData) {
  const limit = getFormLimit(formData);
  const options = getRunOptions(formData);

  redirect(buildGmailXmlPath(options, limit));
}

export async function syncGmailXmlAttachmentsAction(formData?: FormData) {
  const limit = getFormLimit(formData);
  const options = getRunOptions(formData);
  const basePath = buildGmailXmlPath(options, limit);
  let target = basePath;

  try {
    const summary = await syncGmailXmlAttachments(limit, options);
    target = redirectWithParam(
      basePath,
      "notice",
      formatGmailXmlSyncNotice(summary),
    );
  } catch (error) {
    logGmailXmlActionError("syncGmailXmlAttachmentsAction", error);
    target = redirectWithParam(
      basePath,
      "error",
      getErrorMessage(error, "No se pudo importar XML desde Gmail."),
    );
  }

  revalidatePath("/gmail-xml");
  revalidatePath("/documentos");
  revalidatePath("/bandeja");
  redirect(target);
}
