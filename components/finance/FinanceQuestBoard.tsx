"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Coins, ListChecks, Receipt, ScanLine, Utensils, type LucideIcon } from "lucide-react";
import { claimQuest } from "@/app/actions/quests";
import { formatCurrency } from "@/lib/format";
import { emitReaction } from "@/lib/reactionBus";
import { useLanguage } from "@/context/LanguageContext";
import type { QuestId, QuestProgress } from "@/lib/quests";

const ICONS: Record<QuestId, LucideIcon> = {
    logExpense: Receipt,
    aiScan: ScanLine,
    foodUnder200: Utensils,
};

/** Daily finance quests. Claiming is re-verified on the server. */
export default function FinanceQuestBoard({ quests }: { quests: QuestProgress[] }) {
    const { t } = useLanguage();
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<QuestId | null>(null);
    const [, startTransition] = useTransition();

    const doneCount = quests.filter((q) => q.claimed).length;
    const readyCount = quests.filter((q) => q.done && !q.claimed).length;

    function claim(id: QuestId) {
        setError(null);
        setBusyId(id);
        startTransition(async () => {
            const res = await claimQuest(id);
            if (res.ok) emitReaction({ reaction: { key: "react.quest", tone: "cheer" }, coinsGained: res.coins });
            else setError(t(res.error, res.vars));
            setBusyId(null);
        });
    }

    return (
        <section
            id="quests"
            className="scroll-mt-6 rounded-2xl border border-stone-100 bg-card p-5 shadow-sm transition-all hover:shadow-md"
        >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className="flex items-center gap-2 font-bold text-stone-800">
                        <ListChecks className="h-4 w-4 text-sage-ink" />
                        {t("quest.title")}
                    </h3>
                    <p className="text-xs text-stone-500">{t("quest.subtitle")}</p>
                </div>
                <div className="flex items-center gap-2">
                    {readyCount > 0 && (
                        <span className="rounded-full border border-amber-200 bg-amber-100/80 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                            {t("quest.readyBadge", { n: readyCount })}
                        </span>
                    )}
                    <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-stone-600">
                        {doneCount}/{quests.length}
                    </span>
                </div>
            </div>

            {/* status hint: tells the student at a glance that coins are waiting */}
            {readyCount > 0 && (
                <p
                    role="status"
                    className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-100/80 px-3 py-2 text-sm font-medium text-amber-800"
                >
                    <Coins className="h-4 w-4 shrink-0 text-amber-500" />
                    {t("quest.readyHint", { n: readyCount })}
                </p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {quests.map((q) => {
                    const Icon = ICONS[q.id];
                    const isFood = q.id === "foodUnder200";
                    const pct = isFood && q.target ? Math.min(100, ((q.current ?? 0) / q.target) * 100) : q.done ? 100 : 0;
                    const ready = q.done && !q.claimed;

                    return (
                        <div
                            key={q.id}
                            className={`flex flex-col gap-3 rounded-2xl border p-4 transition-all ${q.claimed
                                    ? "border-emerald-100 bg-emerald-50/50"
                                    : ready
                                        ? "border-amber-200 bg-cream ring-1 ring-amber-100"
                                        : "border-stone-100 bg-cream"
                                }`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-sage-ink">
                                    <Icon className="h-5 w-5" />
                                </div>
                                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100/80 px-2 py-0.5 text-xs font-bold tabular-nums text-amber-800">
                                    <Coins className="h-3 w-3 text-amber-500" />+{q.coins}
                                </span>
                            </div>

                            <div className="flex-1">
                                <p className="text-sm font-semibold text-stone-800">{t(`quest.${q.id}`)}</p>
                                <p className="mt-0.5 text-xs leading-relaxed text-stone-500">{t(`quest.${q.id}.desc`)}</p>
                            </div>

                            {isFood && q.target !== undefined && (
                                <div>
                                    <div className="h-2 overflow-hidden rounded-full bg-stone-200">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${q.over ? "bg-rose-400" : "bg-sage-600"}`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                    <p className={`mt-1 text-xs ${q.over ? "font-semibold text-rose-600" : "text-stone-500"}`}>
                                        {q.over
                                            ? t("quest.overLimit")
                                            : q.needsLog
                                                ? t("quest.foodNeedLog")
                                                : t("quest.foodProgress", { cur: formatCurrency(q.current ?? 0), max: formatCurrency(q.target) })}
                                    </p>
                                </div>
                            )}

                            {q.claimed ? (
                                <span className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-50 text-sm font-semibold text-emerald-800">
                                    <CheckCircle2 className="h-4 w-4 text-sage-ink" />
                                    {t("quest.claimed")}
                                </span>
                            ) : ready ? (
                                <button
                                    onClick={() => claim(q.id)}
                                    disabled={busyId === q.id}
                                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-sage-600 text-sm font-bold text-white shadow-sm transition-all hover:bg-sage-700 active:scale-95 disabled:opacity-60"
                                >
                                    <Coins className="h-4 w-4 text-yellow-200" />
                                    {t("quest.claim", { n: q.coins })}
                                </button>
                            ) : (
                                <span className="inline-flex min-h-11 items-center justify-center rounded-xl bg-stone-100 text-sm font-medium text-stone-500">
                                    {t("quest.todo")}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        </section>
    );
}