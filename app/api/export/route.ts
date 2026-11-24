import { auth } from "@/auth";
import { rateLimit } from "@/lib/rateLimit";
import { monthKey } from "@/lib/time";
import { resolveMonth } from "@/lib/months";
import type { Lang } from "@/lib/translations";
import { isExportFormat, type ExportFormat } from "@/lib/export/types";
import { loadExportData } from "@/lib/export/data";
import { buildXlsx } from "@/lib/export/xlsx";
import { buildPdf } from "@/lib/export/pdf";

// NOTE: this is a normal API Route Handler. It must NOT contain "use server".
// GET /api/export?month=2026-11&format=xlsx|pdf&lang=th  ->  moneypixel-2026-11.xlsx / .pdf
// Generated on the server so the file always holds EVERY transaction of the month, and so the download is a plain
// link that works on every phone browser (no client-side blob tricks).

const TYPES: Record<ExportFormat, string> = {
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pdf: "application/pdf",
};

function download(body: Buffer, format: ExportFormat, month: string) {
    return new Response(new Uint8Array(body), {
        headers: {
            "Content-Type": TYPES[format],
            "Content-Disposition": `attachment; filename="moneypixel-${month}.${format}"`,
            "Cache-Control": "no-store",
        },
    });
}

export async function GET(req: Request) {
    // MULTI-USER: only the signed-in user's own transactions are ever exported
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response("Unauthorized", { status: 401 });
    if (!rateLimit(`export:${userId}`, 20, 10 * 60 * 1000).ok) return new Response("Too many requests", { status: 429 });

    const params = new URL(req.url).searchParams;
    const lang: Lang = params.get("lang") === "en" ? "en" : "th";
    const format = params.get("format") ?? "xlsx"; // no format given: Excel
    if (!isExportFormat(format)) return new Response("Unsupported format", { status: 400 }); // csv, json, ... are not offered
    const month = resolveMonth(params.get("month") ?? monthKey()); // invalid or future months fall back to the current one

    try {
        const data = await loadExportData(userId, month, lang);
        switch (format) {
            case "xlsx":
                return download(await buildXlsx(data), format, month);
            case "pdf":
                return download(await buildPdf(data), format, month);
        }
    } catch (err) {
        console.error(`[export] could not build the ${format} file:`, err);
        return new Response("Could not create the file", { status: 500 });
    }
}