"use client";

import { Coins, Download, PiggyBank, Sparkles, Star, TrendingDown, TrendingUp } from "lucide-react";
import CategoryIcon from "@/components/CategoryIcon";
import { getCategory } from "@/lib/categories";
import { formatCurrency } from "@/lib/format";
import { useLanguage } from "@/context/LanguageContext";
import type { MonthlySummary } from "@/lib/summary";

function saverKey(rate: number | null) {
    if (rate === null) return "sum.saver.fresh";
    if (rate >= 30) return "sum.saver.super";
    if (rate >= 10) return "sum.saver.steady";
    if (rate >= 0) return "sum.saver.balanced";
    return "sum.saver.explorer";
}

// Badge for the "logging habit": the more transactions logged, the better the AI advice gets.
function loggingKey(txCount: number) {
    if (txCount >= 20) return "sum.log.star";
    if (txCount >= 8) return "sum.log.regular";
    if (txCount >= 1) return "sum.log.start";
    return "sum.log.none";
}

/** The report cards for one month. Used inside the modal and on the /report page. */
export default function MonthlyReport({ summary: s }: { summary: MonthlySummary }) {
    const { lang, t, tx } = useLanguage();

    const spentPct = s.income > 0 ? Math.min(100, Math.round((s.expense / s.income) * 100)) : s.expense > 0 ? 100 : 0;
    const maxCat = Math.max(1, ...s.topCategories.map((c) => c.amount));

    return (
        <div className="space-y-5">
            {/* Money */}
            <section className="space-y-3 rounded-2xl border border-stone-100 bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                    <h4 className="flex items-center gap-2 font-bold text-stone-800">
                        <PiggyBank className="h-4 w-4 text-sage-ink" />
                        {t("sum.money")}
                    </h4>
                    <span className="rounded-full border border-amber-200 bg-amber-100/80 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                        {t(saverKey(s.savingsRate))}
                    </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-emerald-50 px-4 py-3">
                        <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                            <TrendingUp className="h-3.5 w-3.5" />
                            {t("sum.income")}
                        </p>
                        <p className="mt-1 text-xl font-bold tabular-nums text-stone-800">{formatCurrency(s.income)}</p>
                    </div>
                    <div className="rounded-xl bg-orange-50 px-4 py-3">
                        <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-orange-800">
                            <TrendingDown className="h-3.5 w-3.5" />
                            {t("sum.spent")}
                        </p>
                        <p className="mt-1 text-xl font-bold tabular-nums text-stone-800">{formatCurrency(s.expense)}</p>
                    </div>
                </div>

                <div>
                    <div className="mb-1 flex justify-between gap-2 text-sm">
                        <span className="text-stone-500">{t("sum.spentPct", { pct: spentPct })}</span>
                        <span className={`font-bold tabular-nums ${s.net >= 0 ? "text-sage-ink" : "text-rose-600"}`}>
                            {t(s.net >= 0 ? "sum.left" : "sum.over", { amount: formatCurrency(Math.abs(s.net)) })}
                        </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${spentPct >= 100 ? "bg-orange-400" : "bg-sage-600"}`}
                            style={{ width: `${spentPct}%` }}
                        />
                    </div>
                </div>

                {s.topCategories.length > 0 && (
                    <div className="space-y-2 pt-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{t("sum.topSpending")}</p>
                        {s.topCategories.map((c) => {
                            const cfg = getCategory(c.category);
                            return (
                                <div key={c.category} className="flex items-center gap-3">
                                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${cfg.badge}`}>
                                        <CategoryIcon name={c.category} className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex justify-between gap-2 text-sm">
                                            <span className="font-medium text-stone-700">{tx(`cat.${c.category}`, c.category)}</span>
                                            <span className="shrink-0 tabular-nums text-stone-500">{formatCurrency(c.amount)}</span>
                                        </div>
                                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100">
                                            <div className="h-full rounded-full bg-stone-300" style={{ width: `${(c.amount / maxCat) * 100}%` }} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* Gamification progress */}
            <section className="space-y-3 rounded-2xl border border-stone-100 bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                    <h4 className="flex items-center gap-2 font-bold text-stone-800">
                        <Star className="h-4 w-4 text-sage-ink" />
                        {t("sum.progress")}
                    </h4>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100">
                        {t(loggingKey(s.txCount))}
                    </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-stone-50 px-4 py-3 text-center">
                        <p className="text-2xl font-bold tabular-nums text-stone-800">{s.txCount}</p>
                        <p className="text-sm text-stone-500">{t("sum.txLogged")}</p>
                    </div>
                    <div className="rounded-xl bg-stone-50 px-4 py-3 text-center">
                        <p className="text-2xl font-bold tabular-nums text-stone-800">{s.expEarned}</p>
                        <p className="text-sm text-stone-500">{t("sum.expEarned")}</p>
                    </div>
                </div>
            </section>

            {/* Rewards */}
            <section className="rounded-2xl border border-amber-200 bg-amber-100/80 p-5">
                <div className="flex items-center justify-between gap-2">
                    <h4 className="flex items-center gap-2 font-bold text-amber-800">
                        <Coins className="h-4 w-4 text-amber-500" />
                        {t("sum.coinsEarned")}
                    </h4>
                    <span className="text-2xl font-bold tabular-nums text-amber-800">{s.coinsEarned}</span>
                </div>
                <p className="mt-1 text-sm text-amber-800/80">{t("sum.coinsDetail", { tx: s.coinsEarned, n: s.txCount })}</p>
            </section>

            {/* CSV export: a plain link (not next/link) so nothing is prefetched; the server sends it as a download */}
            <a
                href={`/api/export?month=${s.monthKey}&lang=${lang}`}
                download
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-sage-600 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sage-700 active:scale-[0.98]"
            >
                <Download className="h-4 w-4" />
                {t("csv.download")}
            </a>

            <p className="flex items-center justify-center gap-1.5 text-center text-sm text-stone-500">
                <Sparkles className="h-4 w-4 text-sage-ink" />
                {t("sum.footer")}
            </p>
        </div>
    );
}