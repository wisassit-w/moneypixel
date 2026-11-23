import type { Prisma } from "@prisma/client";

export const EXP_PER_LEVEL = 100;

// AI FINANCE PIVOT: EXP now comes from finance + room activities only (no workouts).
export const EXP_REWARD = {
    transaction: 20,
    aiScan: 30, // bonus EXP for a transaction created with AI Auto-Scan (replaces the usual 20)
    sleep: 15,
    pet: 5,
} as const;

export const PET_COINS = 2;
export const SLEEP_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
export const PET_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

/** Level = floor(exp / 100) + 1 */
export const levelFromExp = (exp: number) => Math.floor(Math.max(0, exp) / EXP_PER_LEVEL) + 1;
/** EXP earned inside the current level (0-99) */
export const expInLevel = (exp: number) => Math.max(0, exp) % EXP_PER_LEVEL;

type Rewards = {
    expToAdd?: number; // may be negative (reverting a deleted transaction)
    coinsToAdd?: number; // may be negative
    energyTo?: number; // set energy to this value
    energyAdd?: number; // or add (capped at 100)
    extra?: Prisma.UserUpdateInput; // e.g. cooldown timestamps
};

/**
 * Server-side only. Grants EXP / coins / energy and keeps roomLevel in sync with EXP.
 * Intentionally NOT a "use server" action: the browser must never be able to call it with arbitrary numbers.
 */
export async function addExpAndCoins(tx: Prisma.TransactionClient, userId: string, r: Rewards) {
    const user = await tx.user.findUnique({
        where: { id: userId },
        select: { exp: true, energyLevel: true },
    });
    if (!user) return null;

    const exp = Math.max(0, user.exp + (r.expToAdd ?? 0));
    const level = levelFromExp(exp);

    const data: Prisma.UserUpdateInput = { ...r.extra, exp, roomLevel: level };
    if (r.coinsToAdd) data.totalCoins = { increment: r.coinsToAdd };
    if (r.energyTo !== undefined) data.energyLevel = r.energyTo;
    else if (r.energyAdd) data.energyLevel = Math.min(100, user.energyLevel + r.energyAdd);

    await tx.user.update({ where: { id: userId }, data });

    return { exp, level, leveledUp: level > levelFromExp(user.exp) };
}