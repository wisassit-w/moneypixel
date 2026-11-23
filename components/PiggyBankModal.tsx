"use client";

import { useEffect, useState, useTransition } from "react";
import { PiggyBank, Pencil, X } from "lucide-react";
import { depositSavings, setSavingsGoal } from "@/app/actions/savings";
import { formatCurrency } from "@/lib/format";
import { emitReaction } from "@/lib/reactionBus";
import { useLanguage } from "@/context/LanguageContext";

type Props = {
    open: boolean;
    onClose: () => void;
    goal: { name: string | null; target: number; current: number };
};

const inputCls =
    "w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-800 outline-none transition-all placeholder:text-stone-400 focus:border-sage-ink/50 focus:bg-card focus:ring-4 focus:ring-emerald-50";

export default function PiggyBankModal({ open, onClose, goal }: Props) {
    const { t } = useLanguage();
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState("");
    const [target, setTarget] = useState("");
    const [reset, setReset] = useState(false);
    const [deposit, setDeposit] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;

    const hasGoal = goal.target > 0;
    const showForm = editing || !hasGoal;
    const pct = hasGoal ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;
    const reached = hasGoal && goal.current >= goal.target;

    function startEdit() {
        setName(goal.name ?? "");
        setTarget(goal.target > 0 ? String(goal.target) : "");
        setReset(false);
        setError(null);
        setEditing(true);
    }

    function saveGoal(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
            const res = await setSavingsGoal({ name, target: Number(target), resetProgress: reset });
            if (res.ok) setEditing(false);
            else setError(t(res.error, res.vars));
        });
    }

    function makeDeposit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
            const res = await depositSavings({ amount: Number(deposit) });
            if (res.ok) {
                setDeposit("");
                // the room shows the cheering message above the avatar
                if (res.reaction) emitReaction({ reaction: res.reaction });
            } else {
                setError(t(res.error, res.vars));
            }
        });
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/30 p-4 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="max-h-[92vh] w-full max-w-md space-y-5 overflow-y-auto rounded-2xl border border-stone-100 bg-card p-6 text-stone-800 shadow-xl">
                <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-lg font-bold">
                        <PiggyBank className="h-5 w-5 text-sage-ink" />
                        {t("piggy.title")}
                    </h3>
                    <button
                        onClick={onClose}
                        aria-label={t("common.close")}
                        className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {showForm ? (
                    <form onSubmit={saveGoal} className="space-y-3">
                        {!hasGoal && <p className="text-sm text-stone-500">{t("piggy.noGoal")}</p>}
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            maxLength={40}
                            required
                            placeholder={t("piggy.goalName")}
                            className={inputCls}
                        />
                        <input
                            value={target}
                            onChange={(e) => setTarget(e.target.value)}
                            type="number"
                            inputMode="decimal"
                            min="1"
                            step="1"
                            required
                            placeholder={t("piggy.target")}
                            className={inputCls}
                        />
                        {hasGoal && (
                            <label className="flex items-center gap-2 text-sm text-stone-600">
                                <input
                                    type="checkbox"
                                    checked={reset}
                                    onChange={(e) => setReset(e.target.checked)}
                                    className="h-4 w-4 accent-sage-600"
                                />
                                {t("piggy.reset")}
                            </label>
                        )}
                        <div className="flex gap-2">
                            <button
                                type="submit"
                                disabled={pending}
                                className="flex-1 rounded-2xl bg-sage-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sage-700 active:scale-[0.98] disabled:opacity-60"
                            >
                                {pending ? t("common.saving") : t("piggy.saveGoal")}
                            </button>
                            {hasGoal && (
                                <button
                                    type="button"
                                    onClick={() => setEditing(false)}
                                    className="rounded-2xl border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-600 transition-all hover:bg-stone-50 active:scale-95"
                                >
                                    {t("piggy.cancel")}
                                </button>
                            )}
                        </div>
                    </form>
                ) : (
                    <>
                        {/* Goal progress */}
                        <div className="space-y-3 rounded-2xl border border-stone-100 bg-cream p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="truncate text-lg font-bold">{goal.name}</p>
                                    <p className="text-sm text-stone-500">
                                        {t("piggy.saved", { cur: formatCurrency(goal.current), target: formatCurrency(goal.target) })}
                                    </p>
                                </div>
                                <button
                                    onClick={startEdit}
                                    aria-label={t("piggy.editGoal")}
                                    className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-card hover:text-sage-ink"
                                >
                                    <Pencil className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="h-3 overflow-hidden rounded-full bg-stone-200">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${reached ? "bg-amber-400" : "bg-sage-600"}`}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>

                            <div className="flex justify-between text-xs">
                                <span className="font-semibold text-stone-600">{t("piggy.percent", { pct })}</span>
                                <span className={reached ? "font-semibold text-amber-700" : "text-stone-500"}>
                                    {reached
                                        ? t("piggy.reached")
                                        : t("piggy.remaining", { amount: formatCurrency(goal.target - goal.current) })}
                                </span>
                            </div>
                        </div>

                        {/* Deposit */}
                        <form onSubmit={makeDeposit} className="space-y-3">
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-stone-400">฿</span>
                                    <input
                                        value={deposit}
                                        onChange={(e) => setDeposit(e.target.value)}
                                        type="number"
                                        inputMode="decimal"
                                        min="1"
                                        step="0.01"
                                        required
                                        placeholder={t("piggy.depositAmount")}
                                        className={`${inputCls} pl-9`}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={pending}
                                    className="rounded-2xl bg-sage-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sage-700 active:scale-95 disabled:opacity-60"
                                >
                                    {t("piggy.deposit")}
                                </button>
                            </div>

                            <div className="flex gap-2">
                                {[50, 100, 500].map((n) => (
                                    <button
                                        key={n}
                                        type="button"
                                        onClick={() => setDeposit(String(n))}
                                        className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 transition-all hover:bg-emerald-100 active:scale-95"
                                    >
                                        +{n}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={startEdit}
                                    className="ml-auto rounded-full px-3 py-1 text-xs font-semibold text-stone-500 transition-all hover:bg-stone-100 active:scale-95"
                                >
                                    {t("piggy.newGoal")}
                                </button>
                            </div>
                        </form>

                        <p className="text-xs text-stone-400">{t("piggy.hint")}</p>
                    </>
                )}

                {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            </div>
        </div>
    );
}