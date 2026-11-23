"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil, Target, TriangleAlert } from "lucide-react";
import { setMonthlyBudget } from "@/app/finance/actions";
import { formatCurrency } from "@/lib/format";
import { budgetStatus } from "@/lib/mood";
import { useLanguage } from "@/context/LanguageContext";

export default function BudgetCard({
    budget,
    spent,
    isCurrentMonth,
}: {
    budget: number;
    spent: number;
    isCurrentMonth: boolean;
}) {
    const { t } = useLanguage();
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const hasBudget = budget > 0;
    const pct = hasBudget ? (spent / budget) * 100 : 0;
    const state = budgetStatus(spent, budget);

    const bar = { none: "bg-stone-200", ok: "bg-sage-600", warn: "bg-amber-400", over: "bg-rose-500" }[state];
    const badge = {
        none: "",
        ok: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100",
        warn: "bg-amber-100/80 text-amber-800 ring-1 ring-amber-200",
        over: "bg-rose-50 text-rose-700 ring-1 ring-rose-100",
    }[state];

    function startEdit() {
        setValue(hasBudget ? String(budget) : "");
        setError(null);
        setEditing(true);
    }

    function save(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
            const res = await setMonthlyBudget(value.trim() === "" ? 0 : Number(value));
            if (res.ok) setEditing(false);
            else setError(t(res.error, res.vars));
        });
    }

    return (
        <section className="flex flex-col rounded-2xl border border-stone-100 bg-card p-5 shadow-sm transition-all hover:shadow-md">
            <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 font-bold text-stone-800">
                    <Target className="h-4 w-4 text-sage-ink" />
                    {t("budget.title")}
                </h3>
                {!editing && hasBudget && (
                    <button
                        onClick={startEdit}
                        aria-label={t("budget.edit")}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-sage-ink"
                    >
                        <Pencil className="h-4 w-4" />
                    </button>
                )}
            </div>

            {editing ? (
                <form onSubmit={save} className="my-auto space-y-3">
                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">{t("budget.amount")}</span>
                        <input
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            max="99999999"
                            autoFocus
                            className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-3 py-3 text-base text-stone-800 outline-none transition-all focus:border-sage-ink/50 focus:bg-card focus:ring-4 focus:ring-emerald-50"
                        />
                    </label>
                    <p className="text-xs text-stone-500">{t("budget.hint")}</p>
                    {error && (
                        <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                            {error}
                        </p>
                    )}
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setEditing(false)}
                            className="min-h-11 flex-1 rounded-2xl border border-stone-200 text-sm font-medium text-stone-600 transition-all hover:bg-stone-50 active:scale-[0.98]"
                        >
                            {t("bills.cancel")}
                        </button>
                        <button
                            type="submit"
                            disabled={pending}
                            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-sage-600 text-sm font-semibold text-white transition-all hover:bg-sage-700 active:scale-[0.98] disabled:opacity-70"
                        >
                            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                            {pending ? t("common.saving") : t("common.save")}
                        </button>
                    </div>
                </form>
            ) : !hasBudget ? (
                <div className="my-auto space-y-3 rounded-2xl border border-dashed border-stone-200 p-5 text-center">
                    <p className="text-sm text-stone-500">{t("budget.none")}</p>
                    <button
                        onClick={startEdit}
                        className="min-h-11 rounded-2xl bg-sage-600 px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sage-700 active:scale-95"
                    >
                        {t("budget.set")}
                    </button>
                </div>
            ) : (
                <div className="my-auto space-y-3">
                    <div className="flex items-end justify-between gap-2">
                        <p className="text-sm text-stone-600">
                            {t("budget.spent", { spent: formatCurrency(spent), budget: formatCurrency(budget) })}
                        </p>
                        <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge}`}>
                            {state !== "ok" && <TriangleAlert className="h-3 w-3" />}
                            {t(`budget.${state}`)}
                        </span>
                    </div>

                    <div
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.min(100, Math.round(pct))}
                        className="h-3 overflow-hidden rounded-full bg-stone-100"
                    >
                        <div className={`h-full rounded-full transition-all duration-500 ${bar}`} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-stone-500">{t("budget.percent", { pct: Math.round(pct) })}</span>
                        <span className={`font-bold tabular-nums ${state === "over" ? "text-rose-600" : "text-sage-ink"}`}>
                            {t(state === "over" ? "sum.over" : "sum.left", { amount: formatCurrency(Math.abs(budget - spent)) })}
                        </span>
                    </div>

                    {!isCurrentMonth && <p className="text-xs text-stone-500">{t("budget.pastNote")}</p>}
                </div>
            )}
        </section>
    );
}