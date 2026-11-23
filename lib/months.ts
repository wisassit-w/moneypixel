import { monthKey } from "@/lib/time";

// Used only when no list of allowed months is given (e.g. the CSV export): how far back a month may be requested
export const MONTH_HISTORY = 24;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const isMonthKey = (v: unknown): v is string => typeof v === "string" && MONTH_RE.test(v);

/** "2026-11" + (-1) = "2026-10" */
export function shiftMonthKey(key: string, delta: number): string {
    const [y, m] = key.split("-").map(Number);
    const idx = y * 12 + (m - 1) + delta;
    return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

/** A date in the middle of that month (Bangkok time), safe to pass to monthRange() and getMonthlySummary() */
export const dateOfMonth = (key: string) => new Date(`${key}-15T12:00:00+07:00`);

/** "November 2026" / "พฤศจิกายน 2569" */
export const monthLabel = (key: string, lang: "th" | "en") =>
    dateOfMonth(key).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", {
        month: "long",
        year: "numeric",
        timeZone: "Asia/Bangkok",
    });

/**
 * Query-string value to a selectable month. With `allowed` (the months that have data), anything else falls back
 * to the current month. Without it, any valid month within MONTH_HISTORY months is accepted.
 */
export function resolveMonth(value: unknown, allowed?: readonly string[], now = new Date()): string {
    const current = monthKey(now);
    if (!isMonthKey(value) || value > current) return current;
    if (allowed) return allowed.includes(value) ? value : current;
    return value < shiftMonthKey(current, -(MONTH_HISTORY - 1)) ? current : value;
}