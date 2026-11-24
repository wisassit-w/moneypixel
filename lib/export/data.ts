import { prisma } from "@/lib/prisma";
import { dayKey, monthRange } from "@/lib/time";
import { dateOfMonth, monthLabel } from "@/lib/months";
import { getMonthlySummary } from "@/lib/summary";
import { hasKey, type Lang } from "@/lib/translations";
import { MAX_ROWS, translator, type ExportData, type ExportRow } from "@/lib/export/types";

/** MULTI-USER: everything here is scoped to `userId`. */
export async function loadExportData(userId: string, month: string, lang: Lang): Promise<ExportData> {
    const when = dateOfMonth(month);
    const { start, end } = monthRange(when);

    const [summary, found] = await Promise.all([
        getMonthlySummary(userId, when),
        prisma.transaction.findMany({
            where: { userId, date: { gte: start, lt: end } },
            orderBy: [{ date: "asc" }, { id: "asc" }],
            take: MAX_ROWS + 1, // one extra row tells us whether the month was cut
            select: {
                date: true,
                type: true,
                category: true,
                description: true,
                amount: true,
                coinsAwarded: true,
                expAwarded: true,
            },
        }),
    ]);

    const truncated = found.length > MAX_ROWS;
    const t = translator(lang);

    const rows: ExportRow[] = (truncated ? found.slice(0, MAX_ROWS) : found).map((r) => ({
        date: dayKey(r.date),
        type: r.type,
        typeLabel: t(r.type === "income" ? "fin.income" : "fin.expense"),
        category: r.category,
        categoryLabel: hasKey(`cat.${r.category}`) ? t(`cat.${r.category}`) : r.category,
        description: r.description ?? "",
        amount: r.amount.toNumber(),
        coinsAwarded: r.coinsAwarded,
        expAwarded: r.expAwarded,
    }));

    return {
        month,
        monthLabel: monthLabel(month, lang),
        lang,
        generatedAt: new Date(),
        summary,
        balance: summary.income - summary.expense,
        rows,
        truncated,
    };
}