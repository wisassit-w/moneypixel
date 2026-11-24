import type { MonthlySummary } from "@/lib/summary";
import { translate, type Lang, type Vars } from "@/lib/translations";

export const EXPORT_FORMATS = ["xlsx", "pdf"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const isExportFormat = (v: unknown): v is ExportFormat =>
    (EXPORT_FORMATS as readonly string[]).includes(v as string);

export const MAX_ROWS = 20_000; // transactions per export

export type ExportRow = {
    date: string; // YYYY-MM-DD in Bangkok time
    type: "income" | "expense";
    typeLabel: string;
    category: string; // stored value, e.g. "Food & Drinks"
    categoryLabel: string; // in the chosen language
    description: string;
    amount: number;
    coinsAwarded: number;
    expAwarded: number;
};

export type ExportData = {
    month: string; // "2026-11"
    monthLabel: string; // "พฤศจิกายน 2569"
    lang: Lang;
    generatedAt: Date;
    summary: MonthlySummary;
    balance: number; // income - expenses
    rows: ExportRow[];
    truncated: boolean; // more than MAX_ROWS transactions existed
};

/** Translator for a fixed language, used by every file builder. */
export const translator = (lang: Lang) => (key: string, vars?: Vars) => translate(lang, key, vars);