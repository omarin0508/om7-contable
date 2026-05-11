"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import type { AssistantSnapshot } from "@/lib/assistant/context";
import {
  buildAssistantGuidance,
  type AssistantGuidance,
} from "@/lib/assistant/rules";

type AssistantContextValue = {
  close: () => void;
  guidance: AssistantGuidance;
  isOpen: boolean;
  open: () => void;
  pathname: string;
  snapshot: AssistantSnapshot;
  toggle: () => void;
};

const AssistantContext = createContext<AssistantContextValue | null>(null);

export function AssistantProvider({
  children,
  snapshot,
}: {
  children: ReactNode;
  snapshot: AssistantSnapshot;
}) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const guidance = useMemo(
    () => buildAssistantGuidance(pathname, snapshot),
    [pathname, snapshot],
  );
  const value = useMemo(
    () => ({
      close: () => setIsOpen(false),
      guidance,
      isOpen,
      open: () => setIsOpen(true),
      pathname,
      snapshot,
      toggle: () => setIsOpen((current) => !current),
    }),
    [guidance, isOpen, pathname, snapshot],
  );

  return (
    <AssistantContext.Provider value={value}>
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistant() {
  const context = useContext(AssistantContext);

  if (!context) {
    throw new Error("useAssistant debe usarse dentro de AssistantProvider.");
  }

  return context;
}
