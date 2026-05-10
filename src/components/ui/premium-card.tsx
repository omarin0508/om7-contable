import type { ReactNode } from "react";

type PremiumCardProps = {
  children: ReactNode;
  className?: string;
};

export function PremiumCard({ children, className = "" }: PremiumCardProps) {
  return (
    <section
      className={`om7-card rounded-2xl ${className}`}
    >
      {children}
    </section>
  );
}
