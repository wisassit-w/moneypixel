import { translator, type ExportData } from "@/lib/export/types";

/** One CSV cell. Text starting with = + - @ (or tab/CR) gets a leading ' so Excel can't run it as a formula. */
function textCell(value: string): string {
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * CSV for Excel. The leading "\uFEFF" is the UTF-8 byte order mark: without it Excel shows Thai text as garbage.
 * CRLF line endings, as Excel expects.
 */
export function buildCsv(data: ExportData): string {
    const t = translator(data.lang);
    const header = ["csv.date", "csv.type", "csv.category", "csv.description", "csv.amount", "csv.coins", "csv.exp"]
        .map((k) => textCell(t(k)))
        .join(",");

    const lines = data.rows.map((r) =>
        [
            r.date,
            textCell(r.typeLabel),
            textCell(r.categoryLabel),
            textCell(r.description),
            r.amount.toFixed(2),
            String(r.coinsAwarded),
            String(r.expAwarded),
        ].join(","),
    );

    return "\uFEFF" + [header, ...lines].join("\r\n") + "\r\n";
}