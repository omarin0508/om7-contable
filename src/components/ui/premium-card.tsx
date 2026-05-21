import type { ReactNode } from "react";

type PremiumCardProps = {
  children: ReactNode;
  className?: string;
};

export function PremiumCard({ children, className = "" }: PremiumCardProps) {
  return (
    <section
      className={`om7-card om7-panel-safe rounded-3xl ${className}`}
    >
      {children}
    </section>
  );
}
