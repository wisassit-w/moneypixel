"use client";

import { useEffect, useState } from "react";
import { ClipboardList, X } from "lucide-react";
import MonthlyReport from "@/components/MonthlyReport";
import { monthLabel } from "@/lib/months";
import { useLanguage } from "@/context/LanguageContext";
import type { MonthlySummary } from "@/lib/summary";

export default function MonthlySummaryModal({ summary }: { summary: MonthlySummary }) {
    const { lang, t } = useLanguage();
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 transition-all hover:bg-emerald-100 hover:shadow-sm active:scale-95"
            >
                <ClipboardList className="h-4 w-4" />
                {t("dash.monthlyReport")}
            </button>

            {open && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/30 p-4 backdrop-blur-sm"
                    onClick={(e) => e.target === e.currentTarget && setOpen(false)}
                >
                    <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-stone-100 bg-card text-stone-800 shadow-xl">
                        {/* Banner */}
                        <div className="flex items-start justify-between bg-sage-600 px-6 py-5 text-white">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-white/80">{t("sum.title")}</p>
                                <h3 className="mt-0.5 text-2xl font-bold">{monthLabel(summary.monthKey, lang)}</h3>
                            </div>
                            <button
                                onClick={() => setOpen(false)}
                                aria-label={t("common.close")}
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="bg-cream p-6">
                            <MonthlyReport summary={summary} />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}