"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  applyTheme,
  getResolvedAppearance,
  isThemeId,
  THEME_STORAGE_KEY,
  type ThemeId,
} from "@/lib/themes";

type ThemeContextValue = {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  resolvedAppearance: "light" | "dark";
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("auto");
  const [resolvedAppearance, setResolvedAppearance] = useState<"light" | "dark">("light");

  const setTheme = useCallback((next: ThemeId) => {
    setThemeState(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
    setResolvedAppearance(getResolvedAppearance(next));
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const initial = stored && isThemeId(stored) ? stored : "indigo";
    setThemeState(initial);
    applyTheme(initial);
    setResolvedAppearance(getResolvedAppearance(initial));

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem(THEME_STORAGE_KEY) || "auto") === "auto") {
        applyTheme("auto");
        setResolvedAppearance(getResolvedAppearance("auto"));
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, resolvedAppearance }),
    [theme, setTheme, resolvedAppearance],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
