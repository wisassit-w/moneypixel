// MoneyPixel students are in Thailand: UTC+7, no daylight saving time.
const TZ = "Asia/Bangkok";
const OFFSET = "+07:00";
const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const p2 = (n: number) => String(n).padStart(2, "0");

/** "2026-11-13" in Bangkok time */
export const dayKey = (d = new Date()) => fmt.format(d);

export function dayRange(d = new Date()) {
    const start = new Date(`${dayKey(d)}T00:00:00${OFFSET}`);
    return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

/** "2026-11" */
export const monthKey = (d = new Date()) => dayKey(d).slice(0, 7);

export function monthRange(d = new Date()) {
    const [y, m] = dayKey(d).split("-").map(Number);
    const [ny, nm] = m === 12 ? [y + 1, 1] : [y, m + 1];
    return {
        start: new Date(`${y}-${p2(m)}-01T00:00:00${OFFSET}`),
        end: new Date(`${ny}-${p2(nm)}-01T00:00:00${OFFSET}`),
    };
}