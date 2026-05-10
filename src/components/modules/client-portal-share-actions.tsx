"use client";

import { useState } from "react";
import {
  buildClientPortalMessage,
  getClientPortalUrl,
} from "@/lib/client-portal";

type CopyState = "idle" | "link" | "message";

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function ClientPortalShareActions() {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  async function handleCopyLink() {
    const portalUrl = getClientPortalUrl();

    await copyText(portalUrl);
    setCopyState("link");
    window.setTimeout(() => setCopyState("idle"), 2200);
  }

  async function handleCopyMessage() {
    const portalUrl = getClientPortalUrl();

    await copyText(buildClientPortalMessage(portalUrl));
    setCopyState("message");
    window.setTimeout(() => setCopyState("idle"), 2200);
  }

  function handleOpenPortal() {
    window.open(getClientPortalUrl(), "_blank", "noopener,noreferrer");
  }

  return (
    <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <button
          className="flex h-10 items-center justify-center rounded-xl border border-white/[0.08] bg-black/20 px-3 text-xs font-medium text-slate-200 transition hover:bg-white/[0.07] hover:text-white"
          onClick={handleCopyLink}
          type="button"
        >
          Copiar enlace
        </button>
        <button
          className="flex h-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/15"
          onClick={handleCopyMessage}
          type="button"
        >
          Copiar mensaje
        </button>
        <button
          className="flex h-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08] hover:text-white"
          onClick={handleOpenPortal}
          type="button"
        >
          Ver portal cliente
        </button>
      </div>

      <p className="mt-2 min-h-5 text-xs text-emerald-200">
        {copyState === "link"
          ? "Enlace copiado"
          : copyState === "message"
            ? "Mensaje copiado"
            : ""}
      </p>
    </div>
  );
}
