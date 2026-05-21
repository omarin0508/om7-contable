import type { CSSProperties, ReactNode } from "react";

export default function ContabilidadLayout({
  children,
}: {
  children: ReactNode;
}) {
  const stickyOffsets = {
    "--om7-actions-sticky-top": "13.25rem",
    "--om7-actions-sticky-top-lg": "12.75rem",
    "--om7-hero-sticky-top": "5rem",
    "--om7-hero-sticky-top-lg": "5rem",
  } as CSSProperties;

  return (
    <div className="flex min-w-0 flex-col gap-4" style={stickyOffsets}>
      {children}
    </div>
  );
}
