"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { hasKey, translate, type Lang, type TKey, type Vars } from "@/lib/translations";

// Gives autocomplete for known keys while still accepting dynamic ones like `cat.${name}`
type KeyLike = TKey | (string & Record<never, never>);

type LanguageCtx = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Translate a key. Returns the key itself if it doesn't exist. */
  t: (key: KeyLike, vars?: Vars) => string;
  /** Translate if the key exists, otherwise return `fallback` (for user-created content). */
  tx: (key: KeyLike, fallback: string, vars?: Vars) => string;
};

const STORAGE_KEY = "cozy-lang";
const EVENT = "cozy-lang-change";

// ---- external store: localStorage, default "th" ----
let override: Lang | null = null; // keeps working even if localStorage is blocked

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

function getSnapshot(): Lang {
  if (override) return override;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "en" || v === "th" ? v : "th";
  } catch {
    return "th";
  }
}

const getServerSnapshot = (): Lang => "th";

// ---- context ----
const defaultValue: LanguageCtx = {
  lang: "th",
  setLang: () => { },
  t: (key, vars) => translate("th", key, vars),
  tx: (key, fallback, vars) => (hasKey(key) ? translate("th", key, vars) : fallback),
};

const LanguageContext = createContext<LanguageCtx>(defaultValue);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const storeLang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  // Match server snapshot ("th") during SSR and initial client hydration so text never mismatches
  const lang: Lang = hydrated ? storeLang : "th";

  const setLang = useCallback((next: Lang) => {
    override = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable: language still switches for this session */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<LanguageCtx>(
    () => ({
      lang,
      setLang,
      t: (key, vars) => translate(lang, key, vars),
      tx: (key, fallback, vars) => (hasKey(key) ? translate(lang, key, vars) : fallback),
    }),
    [lang, setLang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageCtx {
  return useContext(LanguageContext);
}

/**
 * Inline translated text that also works inside SERVER components:
 *   <T k="fin.title" />      <T k="dash.welcome" vars={{ name }} />
 */
export function T({ k, vars }: { k: KeyLike; vars?: Vars }) {
  const { t } = useLanguage();
  return <span suppressHydrationWarning>{t(k, vars)}</span>;
}