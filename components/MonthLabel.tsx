"use client";

import { useLanguage } from "@/context/LanguageContext";

/** "November 2026" in English, or "พฤศจิกายน 2569" in Thai. */
export default function MonthLabel() {
    const { lang } = useLanguage();
    return (
        <>
            {new Date().toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", { month: "long", year: "numeric" })}
        </>
    );
}