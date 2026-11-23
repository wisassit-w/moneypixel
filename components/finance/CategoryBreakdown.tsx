"use client";

import { PieChart } from "lucide-react";
import CategoryIcon from "@/components/CategoryIcon";
import { getCategory } from "@/lib/categories";
import { formatCurrency } from "@/lib/format";
import { useLanguage } from "@/context/LanguageContext";

// Bar colors per expense category (the badge colors in lib/categories.ts are too pale for a chart)
const BAR: Record<string, string> = {
    "Food & Drinks": "bg-orange-400",
    "Dorm & Bills": "bg-stone-400",
    Transport: "bg-sky-400",
    "Books/Stationery": "bg-rose-400",
    "Gaming/Hangout": "bg-amber-400",
};

export default function CategoryBreakdown({ items }: { items: { category: string; amount: number }[] }) {
    const { t, tx } = useLanguage();
    const total = items.reduce((s, i) => s + i.amount, 0);

    return (
        <section className="rounded-2xl border border-stone-100 bg-card p-5 shadow-sm transition-all hover:shadow-md">
            <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 font-bold text-stone-800">
                    <PieChart className="h-4 w-4 text-sage-ink" />
                    {t("breakdown.title")}
                </h3>
                {total > 0 && (
                    <span className="text-xs font-medium text-stone-500">{t("breakdown.total", { amount: formatCurrency(total) })}</span>
                )}
            </div>

            {total <= 0 ? (
                <p className="rounded-2xl border border-dashed border-stone-200 py-8 text-center text-sm text-stone-500">
                    {t("breakdown.empty")}
                </p>
            ) : (
                <div className="space-y-4">
                    {/* one stacked bar: each category's share of the month's spending */}
                    <div className="flex h-4 overflow-hidden rounded-full bg-stone-100" role="img" aria-label={t("breakdown.title")}>
                        {items.map((i) => (
                            <div
                                key={i.category}
                                className={`${BAR[i.category] ?? "bg-stone-300"} transition-all duration-500`}
                                style={{ width: `${(i.amount / total) * 100}%` }}
                                title={`${tx(`cat.${i.category}`, i.category)} ${formatCurrency(i.amount)}`}
                            />
                        ))}
                    </div>

                    <ul className="space-y-3">
                        {items.map((i) => {
                            const share = (i.amount / total) * 100;
                            return (
                                <li key={i.category} className="flex items-center gap-3">
                                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${getCategory(i.category).badge}`}>
                                        <CategoryIcon name={i.category} className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-baseline justify-between gap-2 text-sm">
                                            <span className="truncate font-medium text-stone-700">{tx(`cat.${i.category}`, i.category)}</span>
                                            <span className="shrink-0 text-stone-500">
                                                {formatCurrency(i.amount)} · {Math.round(share)}%
                                            </span>
                                        </div>
                                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100">
                                            <div
                                                className={`h-full rounded-full ${BAR[i.category] ?? "bg-stone-300"} transition-all duration-500`}
                                                style={{ width: `${share}%` }}
                                            />
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </section>
    );
}