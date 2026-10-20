import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "../components/ui";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "sanad_theme";

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function initialTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

/**
 * Platform theme preference. Light is always the default; dark is opt-in and
 * only applies to the product surfaces (auth, onboarding, dashboard). The
 * marketing site and merchant storefronts scope their own theme explicitly.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Storage can be disabled; the in-memory preference still works.
    }
  }, [theme]);

  const setTheme = useCallback((next: ThemeMode) => setThemeState(next), []);
  const toggleTheme = useCallback(() => setThemeState((current) => (current === "dark" ? "light" : "dark")), []);

  const value = useMemo<ThemeContextValue>(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}

export function ThemeToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-brand border border-line bg-card text-xs font-semibold text-ink transition hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/35",
        compact ? "h-9 w-9" : "h-10 px-3",
        className
      )}
      aria-label={dark ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"}
      title={dark ? "الوضع الفاتح" : "الوضع الداكن"}
    >
      {dark ? <Sun className="h-4 w-4 text-brand" /> : <Moon className="h-4 w-4 text-brand" />}
      {compact ? null : <span>{dark ? "فاتح" : "داكن"}</span>}
    </button>
  );
}
