import type { ReactNode } from "react";

type PremiumCardProps = {
  children: ReactNode;
  className?: string;
  id?: string;
};

export function PremiumCard({ children, className = "", id }: PremiumCardProps) {
  return (
    <section
      className={`om7-card om7-panel-safe rounded-3xl ${className}`}
      id={id}
    >
      {children}
    </section>
  );
}
