import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { dayKey, monthKey, monthRange } from "@/lib/time";
import { dateOfMonth, resolveMonth } from "@/lib/months";
import { translate, type Lang } from "@/lib/translations";

// NOTE: this is a normal API Route Handler. It must NOT contain "use server".
// GET /api/export?month=2026-11&lang=th  ->  moneypixel-2026-11.csv
// Generated on the server so the file always holds EVERY transaction of the month.

const MAX_ROWS = 20_000;

/** One CSV cell. Text starting with = + - @ (or tab/CR) gets a leading ' so Excel can't run it as a formula. */
function textCell(value: string): string {
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function GET(req: Request) {
    // MULTI-USER: only the signed-in user's own transactions are ever exported
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response("Unauthorized", { status: 401 });
    if (!rateLimit(`export:${userId}`, 20, 10 * 60 * 1000).ok) return new Response("Too many requests", { status: 429 });

    const params = new URL(req.url).searchParams;
    const lang: Lang = params.get("lang") === "en" ? "en" : "th";
    const month = resolveMonth(params.get("month") ?? monthKey()); // invalid or future months fall back to the current one
    const { start, end } = monthRange(dateOfMonth(month));

    const rows = await prisma.transaction.findMany({
        where: { userId, date: { gte: start, lt: end } },
        orderBy: [{ date: "asc" }, { id: "asc" }],
        take: MAX_ROWS,
        select: { date: true, type: true, category: true, description: true, amount: true, coinsAwarded: true, expAwarded: true },
    });

    const t = (key: string) => translate(lang, key);
    const header = ["csv.date", "csv.type", "csv.category", "csv.description", "csv.amount", "csv.coins", "csv.exp"]
        .map((k) => textCell(t(k)))
        .join(",");

    const lines = rows.map((r) =>
        [
            dayKey(r.date), // YYYY-MM-DD in Bangkok time
            textCell(t(r.type === "income" ? "fin.income" : "fin.expense")),
            textCell(translate(lang, `cat.${r.category}`) || r.category),
            textCell(r.description ?? ""),
            r.amount.toFixed(2),
            String(r.coinsAwarded),
            String(r.expAwarded),
        ].join(","),
    );

    // "\uFEFF" = UTF-8 BOM: without it Excel shows Thai text as garbage. CRLF line endings for Excel.
    const body = "\uFEFF" + [header, ...lines].join("\r\n") + "\r\n";

    return new Response(body, {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="moneypixel-${month}.csv"`,
            "Cache-Control": "no-store",
        },
    });
}