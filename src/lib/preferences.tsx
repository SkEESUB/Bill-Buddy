/**
 * Appearance + locale preferences that must apply instantly across the whole
 * app (theme, reduced motion, currency, timezone).
 *
 * The database is the source of truth; localStorage is only a cache so the
 * correct theme is painted before the authenticated snapshot arrives.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { setDisplayCurrency } from "@/lib/format";

export type ThemeChoice = "light" | "dark" | "system";

export type Preferences = {
  theme: ThemeChoice;
  reducedMotion: boolean;
  currency: string;
  timezone: string;
};

const STORAGE_KEY = "pocketpilot.preferences";

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "system",
  reducedMotion: false,
  currency: "INR",
  timezone: "Asia/Kolkata",
};

type PreferencesContextValue = Preferences & {
  /** Apply preferences locally (persistence to the backend is the caller's job). */
  apply: (patch: Partial<Preferences>) => void;
  /** Resolved theme actually painted right now. */
  resolvedTheme: "light" | "dark";
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function readCache(): Preferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<Preferences>) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [systemDark, setSystemDark] = useState(false);

  // Hydrate from the cache after mount so SSR and the first client render match.
  useEffect(() => setPrefs(readCache()), []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(query.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme: "light" | "dark" =
    prefs.theme === "system" ? (systemDark ? "dark" : "light") : prefs.theme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolvedTheme === "dark");
    root.classList.toggle("reduce-motion", prefs.reducedMotion);
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme, prefs.reducedMotion]);

  useEffect(() => {
    setDisplayCurrency(prefs.currency);
  }, [prefs.currency]);

  const apply = useCallback((patch: Partial<Preferences>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage may be unavailable in private mode — preferences still apply */
      }
      setDisplayCurrency(next.currency);
      return next;
    });
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({ ...prefs, apply, resolvedTheme }),
    [prefs, apply, resolvedTheme],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("usePreferences must be used inside PreferencesProvider");
  return context;
}

/** Common IANA timezones, plus whatever the browser reports. */
export function timezoneOptions(): string[] {
  const common = [
    "Asia/Kolkata",
    "Asia/Dubai",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Europe/London",
    "Europe/Berlin",
    "America/New_York",
    "America/Chicago",
    "America/Los_Angeles",
    "Australia/Sydney",
    "UTC",
  ];
  const local =
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;
  return local && !common.includes(local) ? [local, ...common] : common;
}