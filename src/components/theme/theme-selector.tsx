"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/theme/theme-provider";

const themeOptions = [
  {
    description: "Premium dark",
    label: "Executive Dark",
    value: "dark",
  },
  {
    description: "Premium light",
    label: "Executive Light",
    value: "light",
  },
  {
    description: "Usar sistema",
    label: "Sistema",
    value: "system",
  },
] as const;

type ThemeSelectorProps = {
  compact?: boolean;
};

const subscribeToClient = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function ThemeSelector({ compact = false }: ThemeSelectorProps) {
  const { resolvedTheme, setTheme, theme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribeToClient,
    getClientSnapshot,
    getServerSnapshot,
  );

  if (!mounted) {
    return (
      <div
        aria-hidden="true"
        className={
          compact
            ? "h-10 rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
            : "h-28 rounded-3xl border border-[var(--border)] bg-[var(--surface)]"
        }
      />
    );
  }

  if (compact) {
    const isLight = resolvedTheme === "light";

    return (
      <button
        aria-label="Cambiar tema"
        className="om7-theme-toggle"
        onClick={() => setTheme(isLight ? "dark" : "light")}
        type="button"
      >
        <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />
        <span>{isLight ? "Light" : "Dark"}</span>
      </button>
    );
  }

  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-soft)]">
      <div className="flex flex-col gap-2 sm:flex-row">
        {themeOptions.map((option) => {
          const isActive = theme === option.value;

          return (
            <button
              className={[
                "min-h-16 flex-1 rounded-2xl border px-3 py-2 text-left transition",
                isActive
                  ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--foreground)]"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:bg-[var(--surface-strong)] hover:text-[var(--foreground)]",
              ].join(" ")}
              key={option.value}
              onClick={() => setTheme(option.value)}
              type="button"
            >
              <span className="block text-sm font-semibold">{option.label}</span>
              <span className="mt-1 block text-xs">{option.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
