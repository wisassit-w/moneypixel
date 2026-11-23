"use client";

import { useEffect, useState } from "react";
import { Check, Coins, Footprints, GraduationCap, Layers, Lock, Shirt, User, X, type LucideIcon } from "lucide-react";
import AvatarPreview from "@/components/AvatarPreview";
import { equippedOf, withItem, type AvatarLook } from "@/lib/avatar";
import { GENDERS, ITEMS, type Gender, type Slot } from "@/lib/catalog";
import { useLanguage } from "@/context/LanguageContext";

type Tab = "gender" | Slot;

const TABS: { id: Tab; icon: LucideIcon }[] = [
    { id: "gender", icon: User },
    { id: "hat", icon: GraduationCap },
    { id: "shirt", icon: Shirt },
    { id: "pants", icon: Layers },
    { id: "shoes", icon: Footprints },
];

type Props = {
    look: AvatarLook;
    owned: Record<Slot, string[]>;
    coins: number;
    pending: boolean;
    error: string | null; // already translated
    onEquip: (slot: Slot, itemId: string) => void;
    onGender: (g: Gender) => void;
    onClose: () => void;
};

export default function WardrobeModal({ look, owned, coins, pending, error, onEquip, onGender, onClose }: Props) {
    const { t, tx } = useLanguage();
    const [tab, setTab] = useState<Tab>("shirt");

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/30 p-4 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-stone-100 bg-card text-stone-800 shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
                    <h3 className="flex items-center gap-2 text-lg font-bold">
                        <Shirt className="h-5 w-5 text-sage-ink" />
                        {t("wardrobe.title")}
                    </h3>
                    <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-100/80 px-3 py-1 text-xs font-semibold text-amber-800">
                            <Coins className="h-3.5 w-3.5 text-amber-500" />
                            {coins}
                        </span>
                        <button
                            onClick={onClose}
                            aria-label={t("common.close")}
                            className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div className="grid flex-1 grid-cols-1 overflow-hidden sm:grid-cols-[190px_1fr]">
                    {/* Live preview */}
                    <div className="flex flex-col items-center justify-center gap-2 bg-cream px-4 py-5">
                        <div className="rounded-2xl border border-stone-100 bg-card p-3 shadow-sm">
                            <AvatarPreview look={look} className="h-40" />
                        </div>
                        <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{t("wardrobe.preview")}</p>
                    </div>

                    {/* Tabs + items */}
                    <div className="flex min-h-0 flex-col">
                        <div className="flex gap-1 overflow-x-auto border-b border-stone-100 px-4 py-3">
                            {TABS.map(({ id, icon: Icon }) => (
                                <button
                                    key={id}
                                    onClick={() => setTab(id)}
                                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-semibold transition-all active:scale-95 ${tab === id ? "bg-emerald-50 text-emerald-800" : "text-stone-500 hover:bg-stone-50 hover:text-stone-800"
                                        }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {t(`tab.${id}`)}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            {tab === "gender" ? (
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                    {GENDERS.map((g) => {
                                        const active = look.gender === g.id;
                                        return (
                                            <button
                                                key={g.id}
                                                disabled={pending}
                                                onClick={() => !active && onGender(g.id)}
                                                className={`flex flex-col items-center gap-2 rounded-2xl border bg-card p-3 shadow-sm transition-all enabled:hover:-translate-y-0.5 enabled:hover:shadow-md enabled:active:scale-[0.98] ${active ? "border-sage-ink ring-2 ring-emerald-100" : "border-stone-100"
                                                    }`}
                                            >
                                                <div className="rounded-xl bg-stone-100/70 px-4 py-2">
                                                    <AvatarPreview look={{ ...look, gender: g.id }} className="h-24" />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-sm font-semibold">{t(`gender.${g.id}`)}</p>
                                                    <p className="text-xs text-stone-500">{t(`gender.${g.id}.desc`)}</p>
                                                </div>
                                                {active && (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                                                        <Check className="h-3 w-3" />
                                                        {t("common.selected")}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                    {ITEMS[tab].map((item) => {
                                        const active = equippedOf(look, tab) === item.id;
                                        const isOwned = item.price === 0 || owned[tab].includes(item.id);
                                        const locked = !isOwned && coins < item.price;

                                        return (
                                            <button
                                                key={item.id}
                                                disabled={pending || locked}
                                                onClick={() => !active && onEquip(tab, item.id)}
                                                className={`flex flex-col items-center gap-2 rounded-2xl border bg-card p-3 shadow-sm transition-all enabled:hover:-translate-y-0.5 enabled:hover:shadow-md enabled:active:scale-[0.98] disabled:cursor-not-allowed ${active ? "border-sage-ink ring-2 ring-emerald-100" : "border-stone-100"
                                                    } ${locked ? "opacity-60" : ""}`}
                                            >
                                                <div className="rounded-xl bg-stone-100/70 px-4 py-2">
                                                    <AvatarPreview look={withItem(look, tab, item.id)} className="h-24" />
                                                </div>

                                                <div className="flex w-full items-center justify-center gap-1.5">
                                                    {item.id !== "none" && (
                                                        <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-stone-200" style={{ backgroundColor: item.color }} />
                                                    )}
                                                    <p className="truncate text-sm font-semibold">{tx(`item.${item.id}`, item.name)}</p>
                                                </div>

                                                {active ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                                                        <Check className="h-3 w-3" />
                                                        {t("common.equipped")}
                                                    </span>
                                                ) : isOwned ? (
                                                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                                                        {item.price === 0 ? t("common.free") : t("common.owned")}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100/80 px-2 py-0.5 text-xs font-semibold text-amber-800">
                                                        {locked ? <Lock className="h-3 w-3" /> : <Coins className="h-3 w-3 text-amber-500" />}
                                                        {item.price}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}