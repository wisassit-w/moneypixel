"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import {
    BookOpen,
    Bus,
    Check,
    Droplets,
    House,
    Loader2,
    PartyPopper,
    Pencil,
    Plus,
    Receipt,
    Smartphone,
    Trash2,
    Tv,
    Wifi,
    X,
    Zap,
    type LucideIcon,
} from "lucide-react";
import { createBill, deleteBill, toggleBill, updateBill } from "@/app/finance/actions";
import { BILL_ICON_KEYS, type BillIconKey } from "@/lib/bills";
import { formatCurrency } from "@/lib/format";
import { useLanguage } from "@/context/LanguageContext";

export type BillItem = {
    id: number;
    name: string;
    icon: string; // key into BILL_ICONS
    amount: number;
    paid: boolean; // for the current month
};

const BILL_ICONS: Record<BillIconKey, LucideIcon> = {
    home: House,
    zap: Zap,
    droplets: Droplets,
    smartphone: Smartphone,
    wifi: Wifi,
    tv: Tv,
    bus: Bus,
    book: BookOpen,
    receipt: Receipt,
};

function BillIcon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
    const Icon = BILL_ICONS[name as BillIconKey] ?? Receipt;
    return <Icon className={className} aria-hidden />;
}

const inputCls =
    "w-full rounded-2xl border border-stone-200 bg-stone-50 px-3 py-3 text-base text-stone-800 outline-none transition-all placeholder:text-stone-400 focus:border-sage-ink/50 focus:bg-card focus:ring-4 focus:ring-emerald-50";

// Create (bill = null) or edit a bill
function BillDialog({ bill, displayName, onClose }: { bill: BillItem | null; displayName: string; onClose: () => void }) {
    const { t } = useLanguage();
    const [name, setName] = useState(displayName);
    const [amount, setAmount] = useState(bill ? String(bill.amount) : "");
    const [icon, setIcon] = useState<string>(bill?.icon ?? "receipt");
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    function submit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        const value = Number(amount);

        startTransition(async () => {
            const res = bill
                ? await updateBill({
                    id: bill.id,
                    // an unchanged starter-bill name stays translatable: only send the name when the student changed it
                    name: name.trim() !== displayName ? name : undefined,
                    amount: value,
                    icon,
                })
                : await createBill({ name, amount: value, icon });

            if (res.ok) onClose();
            else setError(t(res.error, res.vars));
        });
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/30 p-4 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <form
                onSubmit={submit}
                className="max-h-[92vh] w-full max-w-sm space-y-4 overflow-y-auto rounded-2xl border border-stone-100 bg-card p-6 text-stone-800 shadow-xl"
            >
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-stone-800">{t(bill ? "bills.edit" : "bills.new")}</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={t("common.close")}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">{t("bills.name")}</span>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        maxLength={40}
                        placeholder={t("bills.namePlaceholder")}
                        className={inputCls}
                    />
                </label>

                <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">{t("bills.amount")}</span>
                    <input
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0.01"
                        max="99999999"
                        required
                        className={inputCls}
                    />
                </label>

                <div>
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">{t("bills.icon")}</span>
                    <div className="grid grid-cols-5 gap-2">
                        {BILL_ICON_KEYS.map((key) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setIcon(key)}
                                aria-label={t(`bills.icon.${key}`)}
                                aria-pressed={icon === key}
                                className={`flex h-11 items-center justify-center rounded-xl border transition-all active:scale-95 ${icon === key
                                        ? "border-sage-ink bg-emerald-50 text-sage-ink"
                                        : "border-stone-200 text-stone-500 hover:bg-stone-50"
                                    }`}
                            >
                                <BillIcon name={key} />
                            </button>
                        ))}
                    </div>
                </div>

                {error && (
                    <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        {error}
                    </p>
                )}

                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="min-h-11 flex-1 rounded-2xl border border-stone-200 text-sm font-medium text-stone-600 transition-all hover:bg-stone-50 active:scale-[0.98]"
                    >
                        {t("bills.cancel")}
                    </button>
                    <button
                        type="submit"
                        disabled={pending}
                        className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-sage-600 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sage-700 active:scale-[0.98] disabled:opacity-70"
                    >
                        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                        {pending ? t("common.saving") : t("common.save")}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default function BillsTracker({ bills }: { bills: BillItem[] }) {
    const { t, tx } = useLanguage();
    const [optimisticBills, toggleOptimistic] = useOptimistic(bills, (state, id: number) =>
        state.map((b) => (b.id === id ? { ...b, paid: !b.paid } : b)),
    );
    const [, startTransition] = useTransition();
    const [dialog, setDialog] = useState<BillItem | "new" | null>(null);
    const [confirmId, setConfirmId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const displayName = (b: BillItem) => tx(`bill.${b.name}`, b.name);

    const paidCount = optimisticBills.filter((b) => b.paid).length;
    const total = optimisticBills.reduce((s, b) => s + b.amount, 0);
    const paidTotal = optimisticBills.filter((b) => b.paid).reduce((s, b) => s + b.amount, 0);
    const left = total - paidTotal;
    const pct = total > 0 ? (paidTotal / total) * 100 : 0;
    const allPaid = optimisticBills.length > 0 && paidCount === optimisticBills.length;

    function handleToggle(id: number) {
        setError(null);
        startTransition(async () => {
            toggleOptimistic(id);
            const res = await toggleBill(id);
            if (!res.ok) setError(t(res.error, res.vars));
        });
    }

    function handleDelete(id: number) {
        setError(null);
        startTransition(async () => {
            const res = await deleteBill(id);
            if (!res.ok) setError(t(res.error, res.vars));
            setConfirmId(null);
        });
    }

    return (
        <div className="flex flex-col rounded-2xl border border-stone-100 bg-card p-5 shadow-sm transition-all hover:shadow-md">
            <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 font-bold text-stone-800">
                    <House className="h-4 w-4 text-sage-ink" />
                    {t("fin.bills")}
                </h3>
                <span className="rounded-full border border-amber-200 bg-amber-100/80 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-amber-800">
                    {t("fin.paidCount", { paid: paidCount, total: optimisticBills.length })}
                </span>
            </div>

            {/* the number that matters: how much is still to pay */}
            {optimisticBills.length > 0 && (
                <div className="mb-3">
                    {allPaid ? (
                        <p className="flex items-center gap-2 text-base font-bold text-sage-ink">
                            <PartyPopper className="h-5 w-5" />
                            {t("bills.allPaid")}
                        </p>
                    ) : (
                        <>
                            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{t("bills.leftToPay")}</p>
                            <p className="text-2xl font-bold tabular-nums text-stone-800">{formatCurrency(left)}</p>
                        </>
                    )}
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
                        <div className="h-full rounded-full bg-sage-600 transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-stone-500">
                        {t("bills.paidTotal", { paid: formatCurrency(paidTotal), total: formatCurrency(total) })}
                    </p>
                </div>
            )}

            {error && (
                <p role="alert" className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {error}
                </p>
            )}

            {optimisticBills.length === 0 && <p className="mb-3 text-sm text-stone-500">{t("bills.empty")}</p>}

            <ul className="space-y-1.5">
                {optimisticBills.map((b) => (
                    <li key={b.id} className={`group rounded-xl transition-all ${b.paid ? "bg-emerald-50/60" : "hover:bg-stone-50"}`}>
                        {confirmId === b.id ? (
                            <div className="flex min-h-12 items-center gap-2 px-3">
                                <span className="flex-1 text-sm font-medium text-stone-700">{t("bills.confirmDelete")}</span>
                                <button
                                    onClick={() => handleDelete(b.id)}
                                    className="min-h-9 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white transition-all hover:bg-rose-700 active:scale-95"
                                >
                                    {t("bills.delete")}
                                </button>
                                <button
                                    onClick={() => setConfirmId(null)}
                                    className="min-h-9 rounded-lg border border-stone-200 px-3 text-xs font-medium text-stone-600 transition-all hover:bg-card active:scale-95"
                                >
                                    {t("bills.cancel")}
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center">
                                <button
                                    onClick={() => handleToggle(b.id)}
                                    aria-pressed={b.paid}
                                    className="flex min-h-12 min-w-0 flex-1 items-center gap-3 px-3 text-left transition-all active:scale-[0.98]"
                                >
                                    <span
                                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all ${b.paid ? "border-sage-600 bg-sage-600 text-white" : "border-stone-300 text-transparent"
                                            }`}
                                    >
                                        <Check className="h-4 w-4" strokeWidth={3} />
                                    </span>
                                    <span className={b.paid ? "text-stone-400" : "text-sage-ink"}>
                                        <BillIcon name={b.icon} />
                                    </span>
                                    <span
                                        className={`min-w-0 flex-1 truncate text-sm font-medium ${b.paid ? "text-stone-500 line-through" : "text-stone-700"
                                            }`}
                                    >
                                        {displayName(b)}
                                    </span>
                                    <span className="text-sm font-semibold tabular-nums text-stone-600">{formatCurrency(b.amount)}</span>
                                </button>

                                <div className="flex shrink-0 pr-1 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                                    <button
                                        onClick={() => setDialog(b)}
                                        aria-label={t("bills.edit")}
                                        className="flex h-10 w-10 items-center justify-center rounded-lg text-stone-400 transition-all hover:bg-card hover:text-sage-ink"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => setConfirmId(b.id)}
                                        aria-label={t("bills.delete")}
                                        className="flex h-10 w-10 items-center justify-center rounded-lg text-stone-400 transition-all hover:bg-rose-50 hover:text-rose-600"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </li>
                ))}
            </ul>

            {/* always at the bottom of the card: when the card is stretched it fills the space on purpose */}
            <button
                onClick={() => setDialog("new")}
                className="mt-auto flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-300 pt-0 text-sm font-semibold text-sage-ink transition-all hover:bg-stone-50 active:scale-[0.98]"
            >
                <Plus className="h-4 w-4" />
                {t("bills.add")}
            </button>

            {dialog && (
                <BillDialog
                    bill={dialog === "new" ? null : dialog}
                    displayName={dialog === "new" ? "" : displayName(dialog)}
                    onClose={() => setDialog(null)}
                />
            )}
        </div>
    );
}