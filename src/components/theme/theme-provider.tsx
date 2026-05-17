"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Theme = "dark" | "light" | "system";
type ResolvedTheme = "dark" | "light";

type ThemeContextValue = {
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  theme: Theme;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "om7-theme";

function getSystemTheme(): ResolvedTheme {
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: light)").matches
  ) {
    return "light";
  }

  return "dark";
}

function getStoredTheme(): Theme {
  if (typeof window === "undefined") {
    return "system";
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);

  return stored === "dark" || stored === "light" || stored === "system"
    ? stored
    : "system";
}

function applyTheme(theme: Theme, resolvedTheme: ResolvedTheme) {
  document.documentElement.classList.remove("dark", "light");
  document.documentElement.classList.add(resolvedTheme);
  document.documentElement.style.colorScheme = resolvedTheme;

  if (theme === "system") {
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    window.localStorage.setItem(STORAGE_KEY, theme);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    const storedTheme = getStoredTheme();

    return storedTheme === "system" ? getSystemTheme() : storedTheme;
  });

  useEffect(() => {
    applyTheme(theme, resolvedTheme);
  }, [resolvedTheme, theme]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");

    function handleChange() {
      setResolvedTheme((currentResolvedTheme) => {
        if (theme !== "system") {
          return currentResolvedTheme;
        }

        const nextResolvedTheme = getSystemTheme();
        applyTheme("system", nextResolvedTheme);
        return nextResolvedTheme;
      });
    }

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [theme]);

  const setTheme = useCallback((nextTheme: Theme) => {
    const nextResolvedTheme =
      nextTheme === "system" ? getSystemTheme() : nextTheme;

    setThemeState(nextTheme);
    setResolvedTheme(nextResolvedTheme);
    applyTheme(nextTheme, nextResolvedTheme);
  }, []);

  const value = useMemo(
    () => ({
      resolvedTheme,
      setTheme,
      theme,
    }),
    [resolvedTheme, setTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);

  if (!value) {
    throw new Error("useTheme debe usarse dentro de ThemeProvider.");
  }

  return value;
}
