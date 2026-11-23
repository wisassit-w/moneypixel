"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { addExpAndCoins } from "@/lib/exp";
import { QUESTS, dayKey } from "@/lib/quests";
import { getQuestProgress } from "@/lib/questState";
import { requireUserId } from "@/lib/session";
import type { Vars } from "@/lib/translations";

export type ClaimResult = { ok: true; coins: number } | { ok: false; error: string; vars?: Vars };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Pays a daily quest reward once per user per day. Conditions are re-checked on the server. */
export async function claimQuest(questId: string): Promise<ClaimResult> {
    const userId = await requireUserId(); // MULTI-USER: progress and claims are per user

    const def = QUESTS.find((q) => q.id === questId);
    if (!def) return fail("err.unknownQuest");

    const progress = (await getQuestProgress(userId)).find((p) => p.id === def.id);
    if (!progress?.done) return fail("err.questNotDone");
    if (progress.claimed) return fail("err.questClaimed");

    try {
        await prisma.$transaction(async (tx) => {
            // the unique key (user, quest, day) makes a double claim impossible, even with two quick clicks
            await tx.questClaim.create({ data: { userId, questId: def.id, day: dayKey() } });
            await addExpAndCoins(tx, userId, { coinsToAdd: def.coins });
        });
    } catch (err) {
        if ((err as { code?: string }).code === "P2002") return fail("err.questClaimed");
        throw err;
    }

    revalidatePath("/");
    return { ok: true, coins: def.coins };
}