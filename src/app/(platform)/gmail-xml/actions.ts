"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  formatGmailXmlSyncNotice,
  getGmailConnectUrl,
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

export async function listGmailXmlMessagesAction() {
  redirect("/gmail-xml?list=xml");
}

export async function syncGmailXmlAttachmentsAction() {
  let target = "/gmail-xml?list=xml";

  try {
    const summary = await syncGmailXmlAttachments();
    target = redirectWithParam(
      "/gmail-xml?list=xml",
      "notice",
      formatGmailXmlSyncNotice(summary),
    );
  } catch (error) {
    logGmailXmlActionError("syncGmailXmlAttachmentsAction", error);
    target = redirectWithParam(
      "/gmail-xml?list=xml",
      "error",
      getErrorMessage(error, "No se pudo importar XML desde Gmail."),
    );
  }

  revalidatePath("/gmail-xml");
  revalidatePath("/documentos");
  revalidatePath("/bandeja");
  redirect(target);
}
