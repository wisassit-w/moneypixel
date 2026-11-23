"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
    FURNITURE,
    PET_PRICE,
    csv,
    getItem,
    isGender,
    type FurnitureKey,
    type Gender,
    type Slot,
} from "@/lib/catalog";
import { EXP_REWARD, PET_COINS, PET_COOLDOWN_MS, SLEEP_COOLDOWN_MS, addExpAndCoins } from "@/lib/exp";
import { requireUserId } from "@/lib/session";
import type { Vars } from "@/lib/translations";

// Errors are returned as translation keys; the UI translates them.
export type ActionResult = { ok: true } | { ok: false; error: string; vars?: Vars };
export type RewardResult =
    | { ok: true; rewarded: boolean; expGained: number; coinsGained: number; leveledUp: boolean; level: number }
    | { ok: false; error: string; vars?: Vars };

const fail = (error: string, vars?: Vars): { ok: false; error: string; vars?: Vars } => ({ ok: false, error, vars });
const refresh = () => revalidatePath("/");

function ownedOf(
    u: { ownedHats: string; ownedShirts: string; ownedPants: string; ownedShoes: string },
    slot: Slot,
): string {
    switch (slot) {
        case "hat":
            return u.ownedHats;
        case "shirt":
            return u.ownedShirts;
        case "pants":
            return u.ownedPants;
        case "shoes":
            return u.ownedShoes;
    }
}

function wardrobePatch(slot: Slot, id: string, ownedCsv: string): Prisma.UserUpdateManyMutationInput {
    switch (slot) {
        case "hat":
            return { hatId: id, ownedHats: ownedCsv };
        case "shirt":
            return { shirtId: id, ownedShirts: ownedCsv };
        case "pants":
            return { pantsId: id, ownedPants: ownedCsv };
        case "shoes":
            return { shoesId: id, ownedShoes: ownedCsv };
    }
}

/** Equip an item. Paid items are bought once (atomically) the first time. */
export async function equipItem({ slot, itemId }: { slot: Slot; itemId: string }): Promise<ActionResult> {
    const userId = await requireUserId(); // MULTI-USER: all queries are scoped to this id

    const item = getItem(slot, itemId);
    if (!item) return fail("err.unknownItem");

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return fail("err.userNotFound");

    const owned = csv(ownedOf(user, slot));

    if (item.price === 0 || owned.includes(item.id)) {
        await prisma.user.update({ where: { id: userId }, data: wardrobePatch(slot, item.id, owned.join(",")) });
    } else {
        const res = await prisma.user.updateMany({
            where: { id: userId, totalCoins: { gte: item.price } },
            data: {
                ...wardrobePatch(slot, item.id, [...owned, item.id].join(",")),
                totalCoins: { decrement: item.price },
            },
        });
        if (res.count === 0) return fail("err.needCoins", { price: item.price });
    }

    refresh();
    return { ok: true };
}

export async function setGender(gender: Gender): Promise<ActionResult> {
    const userId = await requireUserId();
    if (!isGender(gender)) return fail("err.invalidChoice");

    await prisma.user.update({ where: { id: userId }, data: { gender } });
    refresh();
    return { ok: true };
}

export async function buyFurniture({ item }: { item: FurnitureKey }): Promise<ActionResult> {
    const userId = await requireUserId();
    if (!(item in FURNITURE)) return fail("err.unknownItem");
    const f = FURNITURE[item];

    const flag: Prisma.UserUpdateManyMutationInput =
        item === "tv" ? { hasTv: true } : item === "sofa" ? { hasSofa: true } : { hasTreadmill: true };
    const notOwned: Prisma.UserWhereInput =
        item === "tv" ? { hasTv: false } : item === "sofa" ? { hasSofa: false } : { hasTreadmill: false };

    const res = await prisma.user.updateMany({
        where: { id: userId, totalCoins: { gte: f.price }, ...notOwned },
        data: { ...flag, totalCoins: { decrement: f.price } },
    });

    if (res.count === 0) {
        const u = await prisma.user.findUnique({ where: { id: userId } });
        const has = u && (item === "tv" ? u.hasTv : item === "sofa" ? u.hasSofa : u.hasTreadmill);
        return has ? fail("err.alreadyOwned") : fail("err.needCoins", { price: f.price });
    }

    refresh();
    return { ok: true };
}

export async function adoptPet({ type, name }: { type: "cat" | "dog"; name: string }): Promise<ActionResult> {
    const userId = await requireUserId();
    if (type !== "cat" && type !== "dog") return fail("err.unknownPet");

    const clean =
        (typeof name === "string" ? name : "").replace(/\s+/g, " ").trim().slice(0, 20) ||
        (type === "cat" ? "Mochi" : "Bean");

    const res = await prisma.user.updateMany({
        where: { id: userId, petType: "none", totalCoins: { gte: PET_PRICE } },
        data: { petType: type, petName: clean, totalCoins: { decrement: PET_PRICE } },
    });

    if (res.count === 0) {
        const u = await prisma.user.findUnique({ where: { id: userId } });
        return u && u.petType !== "none" ? fail("err.alreadyPet") : fail("err.needCoins", { price: PET_PRICE });
    }

    refresh();
    return { ok: true };
}

/** Sleep in bed: energy to 100 and +15 EXP, at most once per cooldown window. */
export async function sleepInBed(): Promise<RewardResult> {
    const userId = await requireUserId();

    const out = await prisma.$transaction(async (tx) => {
        const u = await tx.user.findUnique({
            where: { id: userId },
            select: { hasBed: true, lastSleepAt: true },
        });
        if (!u) return "missing" as const;
        if (!u.hasBed) return "nobed" as const;
        if (u.lastSleepAt && Date.now() - u.lastSleepAt.getTime() < SLEEP_COOLDOWN_MS) return "cooldown" as const;

        return addExpAndCoins(tx, userId, {
            expToAdd: EXP_REWARD.sleep,
            energyTo: 100,
            extra: { lastSleepAt: new Date() },
        });
    });

    if (out === "missing") return fail("err.userNotFound");
    if (out === "nobed") return fail("err.noBed");
    if (out === "cooldown" || out === null) {
        return { ok: true, rewarded: false, expGained: 0, coinsGained: 0, leveledUp: false, level: 0 };
    }

    refresh();
    return {
        ok: true,
        rewarded: true,
        expGained: EXP_REWARD.sleep,
        coinsGained: 0,
        leveledUp: out.leveledUp,
        level: out.level,
    };
}

/** Pet your pet: +5 EXP and +2 coins, at most once per cooldown window. */
export async function petPet(): Promise<RewardResult> {
    const userId = await requireUserId();

    const out = await prisma.$transaction(async (tx) => {
        const u = await tx.user.findUnique({
            where: { id: userId },
            select: { petType: true, lastPetAt: true },
        });
        if (!u) return "missing" as const;
        if (u.petType === "none") return "nopet" as const;
        if (u.lastPetAt && Date.now() - u.lastPetAt.getTime() < PET_COOLDOWN_MS) return "cooldown" as const;

        return addExpAndCoins(tx, userId, {
            expToAdd: EXP_REWARD.pet,
            coinsToAdd: PET_COINS,
            extra: { lastPetAt: new Date() },
        });
    });

    if (out === "missing") return fail("err.userNotFound");
    if (out === "nopet") return fail("err.noPet");
    if (out === "cooldown" || out === null) {
        return { ok: true, rewarded: false, expGained: 0, coinsGained: 0, leveledUp: false, level: 0 };
    }

    refresh();
    return {
        ok: true,
        rewarded: true,
        expGained: EXP_REWARD.pet,
        coinsGained: PET_COINS,
        leveledUp: out.leveledUp,
        level: out.level,
    };
}