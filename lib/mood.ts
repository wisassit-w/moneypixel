// Shared by the dashboard (room mood, status chips) and the Finance page (budget card, spent hint).
export const WARN_AT = 80; // % of the budget where "almost at your budget" starts

export type BudgetStatus = "none" | "ok" | "warn" | "over";

export function budgetStatus(spent: number, budget: number): BudgetStatus {
    if (!(budget > 0)) return "none";
    const pct = (spent / budget) * 100;
    return pct >= 100 ? "over" : pct >= WARN_AT ? "warn" : "ok";
}

export type RoomMood = "calm" | "careful" | "stressed" | "proud";

/** Money pressure wins; otherwise the room celebrates when every daily quest has been claimed. */
export function roomMood(status: BudgetStatus, allQuestsClaimed: boolean): RoomMood {
    if (status === "over") return "stressed";
    if (status === "warn") return "careful";
    return allQuestsClaimed ? "proud" : "calm";
}