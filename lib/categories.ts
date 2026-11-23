import {
    BookOpen,
    Briefcase,
    Bus,
    Gamepad2,
    GraduationCap,
    House,
    Utensils,
    Wallet,
    type LucideIcon,
} from "lucide-react";

export type TxType = "income" | "expense";

export type CategoryConfig = {
    type: TxType;
    icon: LucideIcon;
    badge: string; // muted earthy pill classes
};

export const CATEGORIES: Record<string, CategoryConfig> = {
    Allowance: { type: "income", icon: GraduationCap, badge: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100" },
    "Part-time": { type: "income", icon: Briefcase, badge: "bg-lime-50 text-lime-800 ring-1 ring-lime-100" },
    "Food & Drinks": { type: "expense", icon: Utensils, badge: "bg-orange-50 text-orange-800 ring-1 ring-orange-100" },
    "Dorm & Bills": { type: "expense", icon: House, badge: "bg-stone-100 text-stone-700 ring-1 ring-stone-200" },
    Transport: { type: "expense", icon: Bus, badge: "bg-sky-50 text-sky-800 ring-1 ring-sky-100" },
    "Books/Stationery": { type: "expense", icon: BookOpen, badge: "bg-rose-50 text-rose-800 ring-1 ring-rose-100" },
    "Gaming/Hangout": { type: "expense", icon: Gamepad2, badge: "bg-amber-100/80 text-amber-800 ring-1 ring-amber-200" },
};

const FALLBACK: CategoryConfig = {
    type: "expense",
    icon: Wallet,
    badge: "bg-stone-50 text-stone-600 ring-1 ring-stone-200",
};

export function getCategory(name: string): CategoryConfig {
    return CATEGORIES[name] ?? FALLBACK;
}

export function categoriesFor(type: TxType) {
    return Object.entries(CATEGORIES).filter(([, c]) => c.type === type);
}