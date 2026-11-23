"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { monthLabel } from "@/lib/months";
import { useLanguage } from "@/context/LanguageContext";

export type FilterType = "all" | "income" | "expense";
export type FilterState = {
    month: string; // selected month, "2026-10"
    currentMonth: string; // today's month in Bangkok
    months: string[]; // months with transactions + the current month, newest first
    type: FilterType;
    q: string;
};

// The URL is the single source of truth: /finance?month=2026-10&type=expense&q=pizza
function useFinanceNav(state: FilterState) {
    const router = useRouter();
    const pathname = usePathname(); // works on /finance and /report
    const [pending, startTransition] = useTransition();

    function go(next: Partial<Pick<FilterState, "month" | "type" | "q">>) {
        const month = next.month ?? state.month;
        const type = next.type ?? state.type;
        const q = next.q ?? state.q;

        const params = new URLSearchParams();
        if (month !== state.currentMonth) params.set("month", month);
        if (type !== "all") params.set("type", type);
        if (q) params.set("q", q);

        const qs = params.toString();
        startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    }

    return { go, pending };
}

const stepBtn =
    "flex h-11 w-11 items-center justify-center rounded-xl border border-stone-200 bg-card text-stone-600 transition-all hover:bg-stone-50 active:scale-95 disabled:pointer-events-none disabled:opacity-40";

export function MonthPicker({ state }: { state: FilterState }) {
    const { lang, t } = useLanguage();
    const { go, pending } = useFinanceNav(state);
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    // months are newest first, so the "older" neighbour is the next item
    const index = state.months.indexOf(state.month);
    const older = index >= 0 ? state.months[index + 1] : undefined;
    const newer = index > 0 ? state.months[index - 1] : undefined;

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        // keep the selected month in view when the list is long
        rootRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: "nearest" });
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    function pick(month: string) {
        setOpen(false);
        if (month !== state.month) go({ month });
    }

    return (
        <div ref={rootRef} className={`flex items-center gap-2 transition-opacity ${pending ? "opacity-60" : ""}`}>
            <button onClick={() => older && go({ month: older })} disabled={!older} aria-label={t("filter.prevMonth")} className={stepBtn}>
                <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="relative">
                <button
                    onClick={() => setOpen((o) => !o)}
                    aria-haspopup="true"
                    aria-expanded={open}
                    aria-label={t("filter.month")}
                    className="flex h-11 min-w-44 items-center justify-between gap-2 rounded-xl border border-stone-200 bg-card px-3 text-sm font-semibold text-stone-800 transition-all hover:bg-stone-50 active:scale-[0.98]"
                >
                    <span>{monthLabel(state.month, lang)}</span>
                    <ChevronDown className={`h-4 w-4 text-stone-500 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>

                {open && (
                    <ul className="absolute left-0 top-full z-30 mt-1 max-h-60 w-full min-w-56 overflow-y-auto rounded-2xl border border-stone-200 bg-card p-1 shadow-lg">
                        {state.months.map((m) => {
                            const selected = m === state.month;
                            return (
                                <li key={m}>
                                    <button
                                        onClick={() => pick(m)}
                                        aria-current={selected ? "true" : undefined}
                                        className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-3 text-left text-sm transition-colors ${selected ? "bg-emerald-50 font-semibold text-emerald-800" : "text-stone-700 hover:bg-stone-50"
                                            }`}
                                    >
                                        <span>{monthLabel(m, lang)}</span>
                                        {m === state.currentMonth ? (
                                            <span className="text-xs font-medium text-stone-500">{t("filter.currentMonth")}</span>
                                        ) : selected ? (
                                            <Check className="h-4 w-4" />
                                        ) : null}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            <button onClick={() => newer && go({ month: newer })} disabled={!newer} aria-label={t("filter.nextMonth")} className={stepBtn}>
                <ChevronRight className="h-4 w-4" />
            </button>
        </div>
    );
}

export function TransactionFilters({ state }: { state: FilterState }) {
    const { t } = useLanguage();
    const { go, pending } = useFinanceNav(state);
    const [text, setText] = useState(state.q);

    // search as you type, 350 ms after the last keystroke
    useEffect(() => {
        if (text.trim() === state.q) return;
        const id = setTimeout(() => go({ q: text.trim().slice(0, 50) }), 350);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text]);

    const options: { id: FilterType; label: string }[] = [
        { id: "all", label: t("filter.all") },
        { id: "income", label: t("fin.income") },
        { id: "expense", label: t("fin.expense") },
    ];

    return (
        <div className={`mb-3 flex flex-col gap-3 transition-opacity sm:flex-row sm:items-center ${pending ? "opacity-60" : ""}`}>
            <div role="tablist" className="grid shrink-0 grid-cols-3 rounded-2xl bg-stone-100 p-1">
                {options.map((o) => (
                    <button
                        key={o.id}
                        role="tab"
                        aria-selected={state.type === o.id}
                        onClick={() => go({ type: o.id })}
                        className={`min-h-9 rounded-xl px-3 text-sm font-semibold transition-all ${state.type === o.id ? "bg-card text-sage-ink shadow-sm" : "text-stone-500 hover:text-stone-700"
                            }`}
                    >
                        {o.label}
                    </button>
                ))}
            </div>

            <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={50}
                    placeholder={t("filter.search")}
                    aria-label={t("filter.search")}
                    className="h-11 w-full rounded-2xl border border-stone-200 bg-stone-50 pl-10 pr-10 text-sm text-stone-800 outline-none transition-all placeholder:text-stone-400 focus:border-sage-ink/50 focus:bg-card focus:ring-4 focus:ring-emerald-50"
                />
                {text && (
                    <button
                        onClick={() => {
                            setText("");
                            go({ q: "" });
                        }}
                        aria-label={t("filter.clear")}
                        className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-stone-400 transition-colors hover:text-stone-600"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>
        </div>
    );
}