"use client";

import { useEffect, useState, useTransition } from "react";
import { Cat, Check, Coins, Dog, Footprints, Lock, ShoppingBag, Sofa, Tv, X, type LucideIcon } from "lucide-react";
import { adoptPet, buyFurniture } from "@/app/actions/user";
import { FURNITURE, PET_PRICE, type FurnitureKey, type PetType } from "@/lib/catalog";
import { useLanguage } from "@/context/LanguageContext";

export type ShopState = {
    coins: number;
    hasTv: boolean;
    hasSofa: boolean;
    hasTreadmill: boolean;
    petType: PetType;
    petName: string | null;
};

const UPGRADES: { key: FurnitureKey; icon: LucideIcon }[] = [
    { key: "tv", icon: Tv },
    { key: "sofa", icon: Sofa },
    { key: "treadmill", icon: Footprints },
];

export default function ShopModal({ open, onClose, shop }: { open: boolean; onClose: () => void; shop: ShopState }) {
    const { t } = useLanguage();
    const [petName, setPetName] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;

    const owned: Record<FurnitureKey, boolean> = {
        tv: shop.hasTv,
        sofa: shop.hasSofa,
        treadmill: shop.hasTreadmill,
    };

    function buy(item: FurnitureKey) {
        setError(null);
        startTransition(async () => {
            const res = await buyFurniture({ item });
            if (!res.ok) setError(t(res.error, res.vars));
        });
    }

    function adopt(type: "cat" | "dog") {
        setError(null);
        startTransition(async () => {
            const res = await adoptPet({ type, name: petName });
            if (!res.ok) setError(t(res.error, res.vars));
        });
    }

    const hasPet = shop.petType !== "none";

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/30 p-4 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-stone-100 bg-card p-6 text-stone-800 shadow-xl">
                <div className="mb-5 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-lg font-bold">
                        <ShoppingBag className="h-5 w-5 text-sage-ink" />
                        {t("shop.title")}
                    </h3>
                    <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-100/80 px-3 py-1 text-xs font-semibold text-amber-800">
                            <Coins className="h-3.5 w-3.5 text-amber-500" />
                            {shop.coins}
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

                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">{t("shop.upgrades")}</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {UPGRADES.map(({ key, icon: Icon }) => {
                        const price = FURNITURE[key].price;
                        const isOwned = owned[key];
                        const short = price - shop.coins;
                        return (
                            <div key={key} className="flex flex-col gap-3 rounded-2xl border border-stone-100 bg-card p-4 shadow-sm transition-all hover:shadow-md">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-sage-ink">
                                    <Icon className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold">{t(`furn.${key}`)}</p>
                                    <p className="mt-0.5 text-xs leading-relaxed text-stone-500">{t(`furn.${key}.desc`)}</p>
                                </div>
                                {isOwned ? (
                                    <span className="inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-50 py-2 text-xs font-semibold text-emerald-800">
                                        <Check className="h-3.5 w-3.5" />
                                        {t("common.owned")}
                                    </span>
                                ) : (
                                    <button
                                        onClick={() => buy(key)}
                                        disabled={pending || short > 0}
                                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-sage-600 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-sage-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500"
                                    >
                                        {short > 0 ? <Lock className="h-3.5 w-3.5" /> : <Coins className="h-3.5 w-3.5 text-yellow-200" />}
                                        {short > 0 ? t("common.needMore", { n: short }) : t("common.buy", { price })}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>

                <p className="mb-2 mt-6 text-xs font-medium uppercase tracking-wide text-stone-500">{t("shop.pets")}</p>
                {!hasPet && (
                    <input
                        value={petName}
                        onChange={(e) => setPetName(e.target.value)}
                        maxLength={20}
                        placeholder={t("pet.namePlaceholder")}
                        className="mb-3 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-800 outline-none transition-all placeholder:text-stone-400 focus:border-sage-ink/50 focus:bg-card focus:ring-4 focus:ring-emerald-50"
                    />
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {(["cat", "dog"] as const).map((type) => {
                        const Icon = type === "cat" ? Cat : Dog;
                        const mine = shop.petType === type;
                        const short = PET_PRICE - shop.coins;
                        return (
                            <div
                                key={type}
                                className={`flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm transition-all hover:shadow-md ${mine ? "border-sage-ink ring-2 ring-emerald-100" : "border-stone-100"
                                    } ${hasPet && !mine ? "opacity-50" : ""}`}
                            >
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100/80 text-amber-800">
                                    <Icon className="h-6 w-6" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold">{t(`pet.${type}`)}</p>
                                    <p className="truncate text-xs text-stone-500">
                                        {mine
                                            ? shop.petName
                                                ? t("pet.adoptedNamed", { name: shop.petName })
                                                : t("pet.adopted")
                                            : hasPet
                                                ? t("pet.onePerRoom")
                                                : t("pet.blurb")}
                                    </p>
                                </div>
                                {mine ? (
                                    <Check className="h-5 w-5 text-sage-ink" />
                                ) : (
                                    !hasPet && (
                                        <button
                                            onClick={() => adopt(type)}
                                            disabled={pending || short > 0}
                                            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-sage-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-sage-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500"
                                        >
                                            {short > 0 ? <Lock className="h-3.5 w-3.5" /> : <Coins className="h-3.5 w-3.5 text-yellow-200" />}
                                            {short > 0 ? t("common.need", { n: short }) : PET_PRICE}
                                        </button>
                                    )
                                )}
                            </div>
                        );
                    })}
                </div>

                {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            </div>
        </div>
    );
}

/** Header button + modal, for pages (e.g. the dashboard) that don't control the modal themselves. */
export function ShopButton({ shop }: { shop: ShopState }) {
    const { t } = useLanguage();
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-sage-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sage-700 hover:shadow-md active:scale-95"
            >
                <ShoppingBag className="h-4 w-4" />
                {t("dash.shop")}
            </button>
            <ShopModal open={open} onClose={() => setOpen(false)} shop={shop} />
        </>
    );
}