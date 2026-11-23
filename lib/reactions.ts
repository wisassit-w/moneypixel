import type { Vars } from "@/lib/translations";

// Message keys live in lib/translations.ts (react.*), so every roast and cheer is bilingual.
export type Reaction = { key: string; tone: "roast" | "cheer"; vars?: Vars };

const pick = (n: number) => 1 + Math.floor(Math.random() * n);

/** AI FINANCE + GAMIFICATION: the room reacts to what you just logged. */
export function reactionForTransaction(t: { type: "income" | "expense"; amount: number; category: string }): Reaction {
    if (t.type === "income") return { key: `react.cheer.income.${pick(2)}`, tone: "cheer" };

    // Big expense (over 500 THB): roast, with a special line for food
    if (t.amount > 500) {
        return t.category === "Food & Drinks"
            ? { key: `react.roast.food.${pick(2)}`, tone: "roast" }
            : { key: `react.roast.${pick(2)}`, tone: "roast" };
    }
    return { key: `react.cheer.log.${pick(2)}`, tone: "cheer" };
}

export function reactionForSavings(reachedGoal: boolean): Reaction {
    return reachedGoal ? { key: "react.goalDone", tone: "cheer" } : { key: `react.cheer.save.${pick(2)}`, tone: "cheer" };
}