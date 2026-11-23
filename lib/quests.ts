// MONEYPIXEL: 3 hardcoded daily finance quests. Progress is computed from what the user
// logged today (see lib/questState.ts); rewards are paid by the claimQuest server action.
export type QuestId = "logExpense" | "aiScan" | "foodUnder200";

export const FOOD_CATEGORY = "Food & Drinks";
export const FOOD_LIMIT = 200; // THB

export const QUESTS = [
    { id: "logExpense", coins: 20 }, // Log 1 Expense Today
    { id: "aiScan", coins: 30 }, // Use AI Auto-Scan 1 Time
    { id: "foodUnder200", coins: 50 }, // Keep Food Expenses under 200 THB
] as const;

export type QuestProgress = {
    id: QuestId;
    coins: number;
    done: boolean; // conditions are met right now
    claimed: boolean; // reward already collected today
    current?: number; // food quest: THB spent on food today
    target?: number; // food quest: limit
    over?: boolean; // food quest: limit exceeded
    needsLog?: boolean; // food quest: no food expense logged yet
};

export { dayKey, dayRange } from "@/lib/time";