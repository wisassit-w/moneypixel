"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { reactionForSavings, type Reaction } from "@/lib/reactions";
import { requireUserId } from "@/lib/session";
import type { Vars } from "@/lib/translations";

const MAX = 99_999_999;

export type SavingsResult = { ok: true; reaction?: Reaction } | { ok: false; error: string; vars?: Vars };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Set (or change) the savings goal, e.g. "Keyboard" / 3000. Optionally restart progress from 0. */
export async function setSavingsGoal(input: {
    name: string;
    target: number;
    resetProgress?: boolean;
}): Promise<SavingsResult> {
    const userId = await requireUserId(); // MULTI-USER: each student has their own piggy bank

    const name = (typeof input.name === "string" ? input.name : "").replace(/\s+/g, " ").trim().slice(0, 40);
    const target = Number(input.target);
    if (!name || !Number.isFinite(target) || target <= 0 || target > MAX) return fail("err.invalidGoal");

    await prisma.user.update({
        where: { id: userId },
        data: {
            savingsGoalName: name,
            savingsGoalTarget: round2(target),
            ...(input.resetProgress ? { savingsCurrent: 0 } : {}),
        },
    });

    revalidatePath("/");
    return { ok: true };
}

/**
 * Put money into the piggy bank. This is a goal tracker kept separate from transactions,
 * so it doesn't distort spending analytics. No coins/EXP are paid for deposits (nothing to farm).
 */
export async function depositSavings({ amount }: { amount: number }): Promise<SavingsResult> {
    const userId = await requireUserId();
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX) return fail("err.invalidDeposit");

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { savingsGoalTarget: true, savingsCurrent: true },
    });
    if (!user) return fail("err.userNotFound");
    if (user.savingsGoalTarget <= 0) return fail("err.noGoal");

    const next = round2(user.savingsCurrent + amount);
    await prisma.user.update({ where: { id: userId }, data: { savingsCurrent: next } });

    const reachedNow = user.savingsCurrent < user.savingsGoalTarget && next >= user.savingsGoalTarget;
    revalidatePath("/");
    return { ok: true, reaction: reactionForSavings(reachedNow) };
}