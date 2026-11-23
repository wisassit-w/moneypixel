import { prisma } from "@/lib/prisma";
import { monthKey } from "@/lib/time";
import { isMonthKey } from "@/lib/months";

/**
 * Months (Bangkok time) in which this student has at least one transaction, plus the current month.
 * Newest first, e.g. ["2026-11", "2026-09"]. MULTI-USER: the query is scoped by userId.
 */
export async function getActiveMonths(userId: string, now = new Date()): Promise<string[]> {
    const current = monthKey(now);
    let months: string[] = [];

    try {
        // dates are stored in UTC: shift to Bangkok (+07:00) before taking the month
        const rows = await prisma.$queryRaw<{ m: string }[]>`
            SELECT DATE_FORMAT(CONVERT_TZ(date, '+00:00', '+07:00'), '%Y-%m') AS m
            FROM transactions
            WHERE userId = ${userId}
            GROUP BY m`;
        months = rows.map((r) => r.m);
    } catch (err) {
        // fallback without raw SQL (slower, but works on any database)
        console.error("[activeMonths] raw query failed, using the fallback:", err);
        const rows = await prisma.transaction.findMany({ where: { userId }, select: { date: true }, take: 20_000 });
        months = rows.map((r) => monthKey(r.date));
    }

    return Array.from(new Set([...months.filter(isMonthKey), current]))
        .filter((m) => m <= current)
        .sort()
        .reverse();
}