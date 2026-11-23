import { prisma } from "@/lib/prisma";
import { FOOD_CATEGORY, FOOD_LIMIT, QUESTS, dayKey, dayRange, type QuestProgress } from "@/lib/quests";

/** Computes today's quest progress from the transactions logged today (by creation time, so backdating can't help). */
export async function getQuestProgress(userId: string, now = new Date()): Promise<QuestProgress[]> {
    const { start, end } = dayRange(now);
    const today = { userId, createdAt: { gte: start, lt: end } };

    const [expenseCount, scanCount, food, claims] = await Promise.all([
        prisma.transaction.count({ where: { ...today, type: "expense" } }),
        prisma.transaction.count({ where: { ...today, aiScanNonce: { not: null } } }),
        prisma.transaction.aggregate({
            where: { ...today, type: "expense", category: FOOD_CATEGORY },
            _sum: { amount: true },
            _count: { _all: true },
        }),
        prisma.questClaim.findMany({ where: { userId, day: dayKey(now) }, select: { questId: true } }),
    ]);

    const claimed = new Set(claims.map((c) => c.questId));
    const foodSum = food._sum.amount?.toNumber() ?? 0;
    const foodCount = food._count._all;

    return QUESTS.map((q): QuestProgress => {
        const base = { id: q.id, coins: q.coins, claimed: claimed.has(q.id) };
        switch (q.id) {
            case "logExpense":
                return { ...base, done: expenseCount >= 1 };
            case "aiScan":
                return { ...base, done: scanCount >= 1 };
            case "foodUnder200":
                // must log at least one food expense, otherwise doing nothing would "win" the quest
                return {
                    ...base,
                    done: foodCount >= 1 && foodSum < FOOD_LIMIT,
                    current: foodSum,
                    target: FOOD_LIMIT,
                    over: foodSum >= FOOD_LIMIT,
                    needsLog: foodCount === 0,
                };
        }
    });
}