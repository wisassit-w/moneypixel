"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/categories";
import { dayRange, monthKey } from "@/lib/time";
import { EXP_REWARD, addExpAndCoins } from "@/lib/exp";
import { requireUserId } from "@/lib/session";
import { verifyScanToken } from "@/lib/scanToken";
import { reactionForTransaction, type Reaction } from "@/lib/reactions";
import { MAX_BILLS, isBillIcon } from "@/lib/bills";
import { cleanName } from "@/lib/validators";
import type { Vars } from "@/lib/translations";

const COIN_REWARD = 10;
const DAILY_REWARDED_LIMIT = 10; // transactions per day that pay coins and EXP
const MAX_AMOUNT = 99_999_999;

// Errors are returned as translation keys; the UI translates them.
export type ActionResult = { ok: true } | { ok: false; error: string; vars?: Vars };

export type TxResult =
    | {
        ok: true;
        reaction: Reaction; // sassy / cheering message for the canvas popup
        expGained: number;
        coinsGained: number;
        leveledUp: boolean;
        level: number;
        aiScanned: boolean;
    }
    | { ok: false; error: string; vars?: Vars };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const round2 = (n: number) => Math.round(n * 100) / 100;
const validAmount = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0 && n <= MAX_AMOUNT;

function refresh() {
    revalidatePath("/finance");
    revalidatePath("/");
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------
export async function addTransaction(formData: FormData): Promise<TxResult> {
    // MULTI-USER: every query below is scoped to the signed-in user
    const userId = await requireUserId();

    const amount = Number(formData.get("amount"));
    const type = String(formData.get("type") ?? "");
    const category = String(formData.get("category") ?? "");
    const description = String(formData.get("description") ?? "").trim().slice(0, 120) || null;
    const dateStr = String(formData.get("date") ?? "");
    const scanToken = String(formData.get("scanToken") ?? "");

    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) return fail("err.invalidAmount");
    if (type !== "income" && type !== "expense") return fail("err.invalidType");
    if (CATEGORIES[category]?.type !== type) return fail("err.pickCategory");

    const date = dateStr ? new Date(`${dateStr}T12:00:00+07:00`) : new Date();
    if (Number.isNaN(date.getTime())) return fail("err.invalidDate");

    // AI Auto-Scan bonus: only for expenses saved with a genuine, unused scan token that belongs to this user.
    let nonce: string | null = null;
    if (scanToken && type === "expense") {
        const candidate = verifyScanToken(scanToken, userId);
        if (candidate && !(await prisma.transaction.findUnique({ where: { aiScanNonce: candidate } }))) {
            nonce = candidate;
        }
    }
    const aiScanned = nonce !== null;

    // Reward cap: after DAILY_REWARDED_LIMIT rewarded transactions today, new ones are saved but pay nothing
    const { start, end } = dayRange();
    const rewardedToday = await prisma.transaction.count({
        where: { userId, createdAt: { gte: start, lt: end }, coinsAwarded: { gt: 0 } },
    });
    const rewarded = rewardedToday < DAILY_REWARDED_LIMIT;

    // +30 EXP (bonus) for an AI-scanned transaction INSTEAD of the usual +20
    const exp = rewarded ? (aiScanned ? EXP_REWARD.aiScan : EXP_REWARD.transaction) : 0;
    const coins = rewarded ? COIN_REWARD : 0;

    const granted = await prisma.$transaction(async (tx) => {
        // the rewards are stored on the row so deleting it can take back exactly this amount
        await tx.transaction.create({
            data: {
                userId,
                amount,
                type,
                category,
                description,
                date,
                coinsAwarded: coins,
                expAwarded: exp,
                aiScanNonce: nonce,
            },
        });
        return addExpAndCoins(tx, userId, { expToAdd: exp, coinsToAdd: coins });
    });

    refresh();
    return {
        ok: true,
        reaction: reactionForTransaction({ type, amount, category }),
        expGained: exp,
        coinsGained: coins,
        leveledUp: granted?.leveledUp ?? false,
        level: granted?.level ?? 1,
        aiScanned,
    };
}

/**
 * Anti-exploit: deleting a transaction reverts the coins AND EXP it awarded.
 * Coins may go negative if they were already spent, so add/spend/delete can't be farmed.
 * A user can only delete their own transactions (userId is part of every where clause).
 */
export async function deleteTransaction(id: number): Promise<ActionResult> {
    const userId = await requireUserId();
    if (!Number.isInteger(id)) return fail("err.invalidTx");

    await prisma.$transaction(async (tx) => {
        const row = await tx.transaction.findFirst({
            where: { id, userId },
            select: { coinsAwarded: true, expAwarded: true },
        });
        if (!row) return;

        const removed = await tx.transaction.deleteMany({ where: { id, userId } });
        // only revert if this call actually deleted the row (guards against double-clicks)
        if (removed.count > 0) {
            await addExpAndCoins(tx, userId, { expToAdd: -row.expAwarded, coinsToAdd: -row.coinsAwarded });
        }
    });

    refresh();
    return { ok: true };
}

// ---------------------------------------------------------------------------
// Fixed bills (every query is scoped to the signed-in user)
// ---------------------------------------------------------------------------
export async function toggleBill(id: number): Promise<ActionResult> {
    const userId = await requireUserId();
    if (!Number.isInteger(id)) return fail("err.billNotFound");

    const bill = await prisma.fixedBill.findFirst({ where: { id, userId } });
    if (!bill) return fail("err.billNotFound");

    const current = monthKey();
    await prisma.fixedBill.update({
        where: { id: bill.id },
        data: { paidMonth: bill.paidMonth === current ? null : current },
    });

    revalidatePath("/finance");
    return { ok: true };
}

export async function createBill(input: { name: string; amount: number; icon: string }): Promise<ActionResult> {
    const userId = await requireUserId();

    const name = cleanName(input?.name);
    if (!name) return fail("err.invalidBillName");
    if (!validAmount(input?.amount)) return fail("err.invalidBillAmount");
    const icon = isBillIcon(input.icon) ? input.icon : "receipt";

    // stops a single account from filling the database
    if ((await prisma.fixedBill.count({ where: { userId } })) >= MAX_BILLS) return fail("err.tooManyBills");

    await prisma.fixedBill.create({ data: { userId, name, icon, amount: round2(input.amount) } });

    revalidatePath("/finance");
    return { ok: true };
}

/** Change the name, amount and/or icon. Only the fields that are passed are changed. */
export async function updateBill(input: {
    id: number;
    name?: string;
    amount?: number;
    icon?: string;
}): Promise<ActionResult> {
    const userId = await requireUserId();
    if (!Number.isInteger(input?.id)) return fail("err.billNotFound");

    const data: Prisma.FixedBillUpdateManyMutationInput = {};
    if (input.name !== undefined) {
        const name = cleanName(input.name);
        if (!name) return fail("err.invalidBillName");
        data.name = name;
    }
    if (input.amount !== undefined) {
        if (!validAmount(input.amount)) return fail("err.invalidBillAmount");
        data.amount = round2(input.amount);
    }
    if (input.icon !== undefined) {
        if (!isBillIcon(input.icon)) return fail("err.invalidChoice");
        data.icon = input.icon;
    }
    if (Object.keys(data).length === 0) return { ok: true };

    // updateMany with userId in the where clause: someone else's bill simply matches nothing
    const res = await prisma.fixedBill.updateMany({ where: { id: input.id, userId }, data });
    if (res.count === 0) return fail("err.billNotFound");

    revalidatePath("/finance");
    return { ok: true };
}

export async function deleteBill(id: number): Promise<ActionResult> {
    const userId = await requireUserId();
    if (!Number.isInteger(id)) return fail("err.billNotFound");

    const res = await prisma.fixedBill.deleteMany({ where: { id, userId } });
    if (res.count === 0) return fail("err.billNotFound");

    revalidatePath("/finance");
    return { ok: true };
}

// ---------------------------------------------------------------------------
// Monthly budget
// ---------------------------------------------------------------------------
/** Set the monthly spending budget in THB. 0 removes the budget. */
export async function setMonthlyBudget(amount: number): Promise<ActionResult> {
    const userId = await requireUserId();
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) {
        return fail("err.invalidBudget");
    }

    const res = await prisma.user.updateMany({ where: { id: userId }, data: { monthlyBudget: round2(amount) } });
    if (res.count === 0) return fail("err.userNotFound");

    revalidatePath("/finance");
    return { ok: true };
}