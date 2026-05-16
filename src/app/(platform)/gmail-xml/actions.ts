"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getGmailConnectUrl,
  testGmailConnection,
} from "@/lib/gmail-xml-import";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
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
