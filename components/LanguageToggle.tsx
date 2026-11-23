"use client";

import { useLanguage } from "@/context/LanguageContext";
import type { Lang } from "@/lib/translations";

const OPTIONS: { id: Lang; label: string }[] = [
    { id: "th", label: "TH" },
    { id: "en", label: "EN" },
];

export default function LanguageToggle() {
    const { lang, setLang, t } = useLanguage();

    return (
        <div
            role="group"
            aria-label={t("lang.label")}
            className="inline-flex items-center rounded-full border border-stone-200/60 bg-stone-100 p-0.5"
        >
            {OPTIONS.map((o) => {
                const active = lang === o.id;
                return (
                    <button
                        key={o.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setLang(o.id)}
                        className={`rounded-full px-3.5 py-1 text-xs font-bold transition-all active:scale-95 ${active ? "bg-sage-600 text-white shadow-sm" : "text-stone-500 hover:text-stone-800"
                            }`}
                    >
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
}