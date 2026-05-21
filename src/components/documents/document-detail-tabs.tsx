"use client";

import { useState } from "react";

type DetailItem = {
  label: string;
  value: string;
};

type DocumentDetailTabsProps = {
  extractionItems: DetailItem[];
  historyItems: DetailItem[];
  originalLabel: string;
  preview: {
    alt: string;
    mimeType: string | null;
    signedUrl: string | null;
  };
  summaryItems: DetailItem[];
  traceItems: DetailItem[];
};

type TabKey = "summary" | "preview" | "extraction" | "trace" | "history";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "summary", label: "Resumen" },
  { key: "preview", label: "Preview" },
  { key: "extraction", label: "Extraccion" },
  { key: "trace", label: "Trazabilidad" },
  { key: "history", label: "Historial" },
];

function FieldList({ items }: { items: DetailItem[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div
          className="rounded-xl border border-white/[0.07] bg-black/15 px-3 py-2"
          key={item.label}
        >
          <p className="text-xs text-slate-500">{item.label}</p>
          <p className="mt-1 break-words text-sm font-semibold text-slate-100">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function PreviewPanel({
  alt,
  mimeType,
  originalLabel,
  signedUrl,
}: {
  alt: string;
  mimeType: string | null;
  originalLabel: string;
  signedUrl: string | null;
}) {
  if (!signedUrl) {
    return (
      <div className="grid h-full min-h-[20rem] place-items-center rounded-2xl border border-dashed border-white/[0.12] bg-black/20 p-8 text-center">
        <div>
          <p className="text-sm font-semibold text-white">Preview no disponible</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            El registro mantiene trazabilidad aunque el enlace firmado no este disponible.
          </p>
        </div>
      </div>
    );
  }

  if (mimeType?.startsWith("image/")) {
    return (
      <img
        alt={alt}
        className="h-full max-h-full w-full rounded-2xl border border-white/[0.08] object-contain"
        src={signedUrl}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <a className="om7-btn-ghost inline-flex px-3 py-2 text-xs" href={signedUrl}>
        {originalLabel}
      </a>
      <iframe
        className="min-h-0 flex-1 rounded-2xl border border-white/[0.08] bg-black/30"
        src={signedUrl}
        title={alt}
      />
    </div>
  );
}

export function DocumentDetailTabs({
  extractionItems,
  historyItems,
  originalLabel,
  preview,
  summaryItems,
  traceItems,
}: DocumentDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("summary");

  return (
    <section className="grid h-[min(64vh,44rem)] min-h-[28rem] grid-rows-[auto_minmax(0,1fr)] rounded-2xl border border-white/[0.08] bg-white/[0.026] p-4 sm:p-5">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            className={[
              "rounded-full border px-3 py-2 text-xs font-semibold transition",
              activeTab === tab.key
                ? "border-cyan-300/34 bg-cyan-300/12 text-cyan-100"
                : "border-white/[0.08] bg-white/[0.035] text-slate-400 hover:text-white",
            ].join(" ")}
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-5 min-h-0 overflow-y-auto pr-1 om7-scrollbar">
        {activeTab === "summary" ? <FieldList items={summaryItems} /> : null}
        {activeTab === "preview" ? (
          <PreviewPanel
            alt={preview.alt}
            mimeType={preview.mimeType}
            originalLabel={originalLabel}
            signedUrl={preview.signedUrl}
          />
        ) : null}
        {activeTab === "extraction" ? <FieldList items={extractionItems} /> : null}
        {activeTab === "trace" ? <FieldList items={traceItems} /> : null}
        {activeTab === "history" ? <FieldList items={historyItems} /> : null}
      </div>
    </section>
  );
}
