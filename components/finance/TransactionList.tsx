"use client";

import { useState, useTransition } from "react";
import { Sprout, Trash2 } from "lucide-react";
import { deleteTransaction } from "@/app/finance/actions";
import { getCategory } from "@/lib/categories";
import CategoryIcon from "@/components/CategoryIcon";
import { useLanguage } from "@/context/LanguageContext";

export type TransactionItem = {
    id: number;
    type: "income" | "expense";
    category: string;
    description: string | null;
    amountLabel: string;
    dateIso: string;
};

export default function TransactionList({
    items,
    emptyKey = "fin.empty",
}: {
    items: TransactionItem[];
    emptyKey?: "fin.empty" | "fin.emptyMonth" | "fin.noResults";
}) {
    const { lang, t, tx } = useLanguage();
    const [pendingId, setPendingId] = useState<number | null>(null);
    const [, startTransition] = useTransition();

    const formatDate = (iso: string) =>
        new Date(iso).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", {
            day: "numeric",
            month: "short",
            timeZone: "Asia/Bangkok",
        });

    function handleDelete(id: number) {
        setPendingId(id);
        startTransition(async () => {
            await deleteTransaction(id);
            setPendingId(null);
        });
    }

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-stone-200 py-12 text-center text-sm text-stone-500">
                <Sprout className="h-6 w-6 text-sage-ink" />
                {t(emptyKey)}
            </div>
        );
    }

    return (
        <ul className="divide-y divide-stone-100">
            {items.map((it) => {
                const cfg = getCategory(it.category);
                return (
                    <li
                        key={it.id}
                        className={`group flex items-center gap-4 py-3 transition-opacity ${pendingId === it.id ? "opacity-40" : ""}`}
                    >
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${cfg.badge}`}>
                            <CategoryIcon name={it.category} className="h-5 w-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.badge}`}>
                                    {tx(`cat.${it.category}`, it.category)}
                                </span>
                                <span className="text-xs text-stone-500">{formatDate(it.dateIso)}</span>
                            </div>
                            {it.description && <p className="mt-0.5 truncate text-sm text-stone-600">{it.description}</p>}
                        </div>

                        <span className={`text-base font-bold tabular-nums ${it.type === "income" ? "text-sage-ink" : "text-rose-600"}`}>
                            {it.amountLabel}
                        </span>

                        <button
                            onClick={() => handleDelete(it.id)}
                            disabled={pendingId === it.id}
                            aria-label={t("fin.deleteTx")}
                            className="rounded-lg p-2 text-stone-300 transition-all hover:bg-rose-50 hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}