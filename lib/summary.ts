import { prisma } from "@/lib/prisma";
import { monthKey, monthRange } from "@/lib/time";

// MONEYPIXEL: the monthly report is 100% finance + gamification
// (money in/out, top categories, and the coins/EXP earned by logging transactions).
export type MonthlySummary = {
    monthKey: string; // "2026-11": used for the month label and the CSV download
    monthLabel: string;
    income: number;
    expense: number;
    net: number;
    savingsRate: number | null; // % of income kept
    txCount: number;
    topCategories: { category: string; amount: number }[];
    coinsEarned: number;
    expEarned: number;
};

/** `now` can be any date inside the month you want (see dateOfMonth in lib/months.ts). */
export async function getMonthlySummary(userId: string, now = new Date()): Promise<MonthlySummary> {
    const { start, end } = monthRange(now);
    const txWhere = { userId, date: { gte: start, lt: end } };

    const [byType, topExpenses, txCount, rewards] = await Promise.all([
        prisma.transaction.groupBy({ by: ["type"], where: txWhere, _sum: { amount: true } }),
        prisma.transaction.groupBy({
            by: ["category"],
            where: { ...txWhere, type: "expense" },
            _sum: { amount: true },
            orderBy: { _sum: { amount: "desc" } },
            take: 3,
        }),
        prisma.transaction.count({ where: txWhere }),
        // the real rewards stored on each row (they respect the daily cap, scan bonus and deletions)
        prisma.transaction.aggregate({ where: txWhere, _sum: { coinsAwarded: true, expAwarded: true } }),
    ]);

    const sum = (type: "income" | "expense") =>
        byType.find((r) => r.type === type)?._sum.amount?.toNumber() ?? 0;

    const income = sum("income");
    const expense = sum("expense");

    return {
        monthKey: monthKey(now),
        monthLabel: now.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" }),
        income,
        expense,
        net: income - expense,
        savingsRate: income > 0 ? Math.round(((income - expense) / income) * 100) : null,
        txCount,
        topCategories: topExpenses.map((r) => ({
            category: r.category,
            amount: r._sum.amount?.toNumber() ?? 0,
        })),
        coinsEarned: rewards._sum.coinsAwarded ?? 0,
        expEarned: rewards._sum.expAwarded ?? 0,
    };
}