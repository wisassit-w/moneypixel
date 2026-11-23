"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { DEFAULT_THEME, THEME_COLOR, THEME_STORAGE_KEY, isTheme, type Theme } from "@/lib/theme";

const EVENT = "moneypixel-theme-change";

// The <html data-theme> attribute (set before first paint by THEME_INIT_SCRIPT) is the source of truth.
function getSnapshot(): Theme {
    const attr = document.documentElement.getAttribute("data-theme");
    return isTheme(attr) ? attr : DEFAULT_THEME;
}
const getServerSnapshot = (): Theme => DEFAULT_THEME;

function apply(theme: Theme) {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.style.colorScheme = theme === "dark" ? "dark" : "light";
}

function subscribe(onChange: () => void) {
    // another tab changed the theme
    const onStorage = (e: StorageEvent) => {
        if (e.key === THEME_STORAGE_KEY && isTheme(e.newValue)) {
            apply(e.newValue);
            onChange();
        }
    };
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
        window.removeEventListener(EVENT, onChange);
        window.removeEventListener("storage", onStorage);
    };
}

type ThemeCtx = { theme: Theme; setTheme: (theme: Theme) => void };

const ThemeContext = createContext<ThemeCtx>({ theme: DEFAULT_THEME, setTheme: () => { } });

export function ThemeProvider({ children }: { children: ReactNode }) {
    const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    // keep the phone's browser bar in the theme colour
    useEffect(() => {
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
    }, [theme]);

    const value = useMemo<ThemeCtx>(
        () => ({
            theme,
            setTheme: (next) => {
                apply(next);
                try {
                    localStorage.setItem(THEME_STORAGE_KEY, next);
                } catch {
                    /* storage unavailable: the theme still switches for this session */
                }
                window.dispatchEvent(new Event(EVENT));
            },
        }),
        [theme],
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);