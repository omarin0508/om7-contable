"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  archiveDocumentAction,
  inactivateDocumentAction,
  restoreDocumentAction,
  softDeleteDocumentAction,
  updateDocumentMetadataAction,
} from "@/app/(platform)/documentos/actions";
import type { DocumentRecord } from "@/lib/storage";

type DocumentManagementMenuProps = {
  document: DocumentRecord;
  onEdit?: (document: DocumentRecord) => void;
  redirectTo: string;
  variant?: "menu" | "panel";
};

const documentTypes = ["factura", "compra", "contrato", "estado_cuenta", "otro"];

function getDocumentTitle(document: DocumentRecord) {
  return document.display_name || document.original_filename || "Documento";
}

function getTags(document: DocumentRecord) {
  const tags = document.metadata?.tags;

  return Array.isArray(tags) ? tags.map(String).join(", ") : "";
}

function DocumentMetadataForm({
  document,
  redirectTo,
  onCancel,
}: {
  document: DocumentRecord;
  redirectTo: string;
  onCancel?: () => void;
}) {
  return (
    <form action={updateDocumentMetadataAction} className="flex min-h-full flex-col">
      <input name="documentId" type="hidden" value={document.id} />
      <input name="redirectTo" type="hidden" value={redirectTo} />

      <div className="flex-1 space-y-4 pb-5">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Nombre visible
          </span>
          <input
            className="mt-1.5 h-11 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:ring-4 focus:ring-cyan-300/10"
            defaultValue={document.display_name ?? ""}
            name="displayName"
            placeholder={document.original_filename ?? "Nombre del documento"}
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Tipo documento
          </span>
          <select
            className="mt-1.5 h-11 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 text-sm text-white outline-none transition focus:border-cyan-300/35 focus:ring-4 focus:ring-cyan-300/10"
            defaultValue={document.document_type}
            name="documentType"
          >
            {documentTypes.map((type) => (
              <option className="bg-slate-950" key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Etiquetas
          </span>
          <input
            className="mt-1.5 h-11 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:ring-4 focus:ring-cyan-300/10"
            defaultValue={getTags(document)}
            name="tags"
            placeholder="proveedor, urgente, demo"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Notas internas
          </span>
          <textarea
            className="mt-1.5 min-h-32 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:ring-4 focus:ring-cyan-300/10"
            defaultValue={document.notes ?? ""}
            name="notes"
            placeholder="Notas para el equipo interno."
          />
        </label>
      </div>

      <div className="sticky bottom-0 -mx-5 grid gap-2 border-t border-white/[0.08] bg-slate-950/95 px-5 pb-5 pt-4 backdrop-blur-xl sm:grid-cols-2">
        <button
          className="om7-btn-ghost w-full px-4"
          onClick={onCancel}
          type="button"
        >
          Cancelar
        </button>
        <button className="om7-btn-primary w-full px-4" type="submit">
          Guardar cambios
        </button>
      </div>
    </form>
  );
}

function LifecycleActions({
  document,
  redirectTo,
}: {
  document: DocumentRecord;
  redirectTo: string;
}) {
  const archived = Boolean(document.archived_at);
  const inactive = Boolean(document.inactive_at);
  const deleted = Boolean(document.deleted_at);
  const canRestore = archived || inactive || deleted;

  return (
    <div className="space-y-2">
      {!archived && !deleted ? (
        <form action={archiveDocumentAction}>
          <input name="documentId" type="hidden" value={document.id} />
          <input name="redirectTo" type="hidden" value={redirectTo} />
          <button className="om7-btn-secondary w-full px-4" type="submit">
            Archivar
          </button>
        </form>
      ) : null}

      {!inactive && !deleted ? (
        <form action={inactivateDocumentAction}>
          <input name="documentId" type="hidden" value={document.id} />
          <input name="redirectTo" type="hidden" value={redirectTo} />
          <button className="om7-btn-ghost w-full px-4" type="submit">
            Ocultar / inactivar
          </button>
        </form>
      ) : null}

      {canRestore ? (
        <form action={restoreDocumentAction}>
          <input name="documentId" type="hidden" value={document.id} />
          <input name="redirectTo" type="hidden" value={redirectTo} />
          <button className="om7-btn-secondary w-full px-4" type="submit">
            Restaurar
          </button>
        </form>
      ) : null}

      {!deleted ? (
        <form
          action={softDeleteDocumentAction}
          className="rounded-2xl border border-rose-300/15 bg-rose-300/[0.04] p-3"
        >
          <input name="documentId" type="hidden" value={document.id} />
          <input name="redirectTo" type="hidden" value={redirectTo} />
          <label className="flex items-start gap-2 text-xs leading-5 text-rose-100/75">
            <input
              className="mt-1 h-3.5 w-3.5 rounded border-rose-200/30 bg-black/30"
              name="confirmDelete"
              required
              type="checkbox"
              value="confirmado"
            />
            Confirmo que quiero ocultar este documento como eliminado. El
            archivo original no se borra de Storage.
          </label>
          <button
            className="mt-3 inline-grid min-h-10 w-full place-items-center rounded-xl border border-rose-300/30 bg-rose-400/12 px-4 text-sm font-bold text-rose-100 transition hover:bg-rose-400/18"
            type="submit"
          >
            Eliminar
          </button>
        </form>
      ) : null}
    </div>
  );
}

export function DocumentEditDrawer({
  document,
  open,
  onClose,
  redirectTo,
}: {
  document: DocumentRecord | null;
  open: boolean;
  onClose: () => void;
  redirectTo: string;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = globalThis.document.body.style.overflow;
    globalThis.document.body.style.overflow = "hidden";

    return () => {
      globalThis.document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || !document || typeof globalThis.document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      aria-modal="true"
      className="fixed inset-0 z-[120] overflow-hidden"
      role="dialog"
    >
      <button
        aria-label="Cerrar editor"
        className="absolute inset-0 h-full w-full cursor-default bg-slate-950/72 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />
      <section className="absolute inset-0 flex flex-col overflow-hidden border-white/[0.1] bg-slate-950 shadow-2xl shadow-black/50 sm:left-auto sm:w-[min(32rem,100vw)] sm:border-l">
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] p-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/70">
              Gestion documental
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
              Editar documento
            </h2>
            <p className="mt-1 truncate text-sm text-slate-500">
              {getDocumentTitle(document)}
            </p>
          </div>
          <button
            className="om7-btn-ghost h-10 w-10 text-lg"
            onClick={onClose}
            type="button"
          >
            x
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
          <DocumentMetadataForm
            document={document}
            onCancel={onClose}
            redirectTo={redirectTo}
          />
        </div>
      </section>
    </div>
    ,
    globalThis.document.body,
  );
}

export function DocumentManagementMenu({
  document,
  onEdit,
  redirectTo,
  variant = "menu",
}: DocumentManagementMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);

  if (variant === "panel") {
    return (
      <section className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-4 shadow-xl shadow-black/10">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">
              Gestion documental
            </p>
            <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">
              {getDocumentTitle(document)}
            </p>
          </div>
          <span className="om7-chip">Admin</span>
        </div>
        <button
          className="om7-btn-primary w-full px-4"
          onClick={() => {
            if (onEdit) {
              onEdit(document);
              return;
            }

            setEditorOpen(true);
          }}
          type="button"
        >
          Editar documento
        </button>
        <div className="mt-3">
          <LifecycleActions document={document} redirectTo={redirectTo} />
        </div>
        {onEdit ? null : (
          <DocumentEditDrawer
            document={document}
            onClose={() => setEditorOpen(false)}
            open={editorOpen}
            redirectTo={redirectTo}
          />
        )}
      </section>
    );
  }

  return (
    <div className="relative inline-flex justify-end">
      <button
        aria-label="Acciones documentales"
        className="om7-btn-ghost flex h-10 w-11 cursor-pointer list-none items-center justify-center px-3 text-lg leading-none shadow-lg shadow-black/20"
        onClick={() => setMenuOpen((current) => !current)}
        type="button"
      >
        ...
      </button>

      {menuOpen ? (
        <div className="absolute right-0 top-12 z-[80] w-[min(18rem,calc(100vw-2rem))] rounded-3xl border border-white/[0.1] bg-slate-950/95 p-3 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <button
            className="om7-btn-primary w-full px-4"
            onClick={() => {
              setMenuOpen(false);
              if (onEdit) {
                onEdit(document);
                return;
              }

              setEditorOpen(true);
            }}
            type="button"
          >
            Editar informacion
          </button>
          <div className="mt-3 border-t border-white/[0.08] pt-3">
            <LifecycleActions document={document} redirectTo={redirectTo} />
          </div>
        </div>
      ) : null}

      {onEdit ? null : (
        <DocumentEditDrawer
          document={document}
          onClose={() => setEditorOpen(false)}
          open={editorOpen}
          redirectTo={redirectTo}
        />
      )}
    </div>
  );
}
