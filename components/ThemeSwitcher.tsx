"use client";

import { Coffee, Flower2, Moon, type LucideIcon } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { THEMES, type Theme } from "@/lib/theme";

const ICONS: Record<Theme, LucideIcon> = { cozy: Coffee, pastel: Flower2, dark: Moon };

/** Three round buttons, sits next to the TH | EN toggle. */
export default function ThemeSwitcher() {
    const { theme, setTheme } = useTheme();
    const { t } = useLanguage();

    return (
        <div
            role="radiogroup"
            aria-label={t("theme.label")}
            className="inline-flex items-center rounded-full border border-stone-200/60 bg-stone-100 p-0.5"
        >
            {THEMES.map((id) => {
                const Icon = ICONS[id];
                const active = theme === id;
                return (
                    <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={t(`theme.${id}`)}
                        title={t(`theme.${id}`)}
                        onClick={() => setTheme(id)}
                        className={`flex h-8 w-8 items-center justify-center rounded-full transition-all active:scale-95 ${active ? "bg-sage-600 text-white shadow-sm" : "text-stone-500 hover:text-stone-800"
                            }`}
                    >
                        <Icon className="h-4 w-4" />
                    </button>
                );
            })}
        </div>
    );
}