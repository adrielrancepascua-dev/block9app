"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "block9-theme";

interface ThemeContextValue {
  theme: ThemeChoice;
  setTheme: (theme: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  setTheme: () => {},
});

export function applyTheme(theme: ThemeChoice) {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && systemDark);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  const color = dark ? "#101c2e" : "#f7f4ef";
  document.querySelectorAll('meta[name="theme-color"]').forEach((node) => {
    node.setAttribute("content", color);
  });
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>("system");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const next: ThemeChoice = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    setThemeState(next);
    applyTheme(next);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const current = window.localStorage.getItem(STORAGE_KEY);
      if (current !== "light" && current !== "dark") applyTheme("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const setTheme = (next: ThemeChoice) => {
    setThemeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
