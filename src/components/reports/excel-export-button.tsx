"use client";

import { useState } from "react";

export function ExcelExportButton({ href }: { href: string }) {
  const [isPreparing, setIsPreparing] = useState(false);

  return (
    <a
      className={[
        "om7-btn-primary px-4 py-2.5",
        isPreparing ? "pointer-events-none opacity-70" : "",
      ].join(" ")}
      href={href}
      onClick={() => {
        setIsPreparing(true);
        window.setTimeout(() => setIsPreparing(false), 4000);
      }}
    >
      {isPreparing ? "Preparando Excel profesional..." : "Exportar Excel"}
    </a>
  );
}
