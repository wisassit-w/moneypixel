"use client";

import { Download, FileSpreadsheet, FileText, type LucideIcon } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

const FORMATS: { id: "xlsx" | "pdf"; label: string; hint: string; ext: string; icon: LucideIcon }[] = [
    { id: "xlsx", label: "export.excel", hint: "export.excelHint", ext: ".xlsx", icon: FileSpreadsheet },
    { id: "pdf", label: "export.pdf", hint: "export.pdfHint", ext: ".pdf", icon: FileText },
];

/**
 * Download this month's summary and transactions as Excel or PDF. Each option is a plain link to /api/export
 * (a normal file download, not a script-made blob), so it works the same on desktop and in phone browsers.
 */
export default function ExportMenu({ month }: { month: string }) {
    const { lang, t } = useLanguage();

    return (
        <section className="rounded-2xl border border-stone-100 bg-card p-5 shadow-sm">
            <h4 className="flex items-center gap-2 font-bold text-stone-800">
                <Download className="h-4 w-4 text-sage-ink" />
                {t("export.title")}
            </h4>
            <p className="mb-3 mt-0.5 text-sm text-stone-500">{t("export.hint")}</p>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {FORMATS.map(({ id, label, hint, ext, icon: Icon }) => (
                    <a
                        key={id}
                        href={`/api/export?month=${month}&format=${id}&lang=${lang}`}
                        download
                        className="flex min-h-14 items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 transition-all hover:border-sage-ink/40 hover:bg-emerald-50 active:scale-[0.98]"
                    >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-sage-ink">
                            <Icon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                            <span className="flex items-baseline gap-1.5">
                                <span className="text-sm font-semibold text-stone-800">{t(label)}</span>
                                <span className="text-xs font-medium text-stone-500">{ext}</span>
                            </span>
                            <span className="block text-xs text-stone-500">{t(hint)}</span>
                        </span>
                    </a>
                ))}
            </div>
        </section>
    );
}