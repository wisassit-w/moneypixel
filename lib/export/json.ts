import type { ExportData } from "@/lib/export/types";

/** A readable JSON backup: summary + every transaction of the month. Category keeps the stored value. */
export function buildJson(data: ExportData): string {
    const s = data.summary;
    return JSON.stringify(
        {
            app: "MoneyPixel",
            version: 1,
            month: data.month,
            currency: "THB",
            generatedAt: data.generatedAt.toISOString(),
            summary: {
                income: s.income,
                expense: s.expense,
                balance: data.balance,
                savingsRate: s.savingsRate, // % of income kept, null when there is no income
                transactionCount: s.txCount,
                coinsEarned: s.coinsEarned,
                expEarned: s.expEarned,
                topCategories: s.topCategories,
            },
            truncated: data.truncated,
            transactions: data.rows.map((r) => ({
                date: r.date,
                type: r.type,
                category: r.category,
                description: r.description,
                amount: r.amount,
                coinsAwarded: r.coinsAwarded,
                expAwarded: r.expAwarded,
            })),
        },
        null,
        2,
    );
}