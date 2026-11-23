import type { Reaction } from "@/lib/reactions";

export const REACTION_EVENT = "moneypixel:reaction";
const STORAGE_KEY = "moneypixel:pending-reaction";

export type ReactionPayload = {
    reaction?: Reaction;
    expGained?: number;
    coinsGained?: number;
    leveledUp?: boolean;
};

/**
 * Tell the 2D room to show floating text. If the room isn't mounted (e.g. you saved on /finance),
 * the payload is kept in sessionStorage and shown the next time the dashboard opens.
 */
export function emitReaction(payload: ReactionPayload) {
    if (typeof window === "undefined") return;
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ at: Date.now(), payload }));
    } catch {
        /* storage unavailable: the live event below still works */
    }
    window.dispatchEvent(new CustomEvent<ReactionPayload>(REACTION_EVENT, { detail: payload }));
}

/** Returns (and clears) a reaction saved within the last minute, if any. */
export function consumePendingReaction(maxAgeMs = 60_000): ReactionPayload | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        sessionStorage.removeItem(STORAGE_KEY);
        const { at, payload } = JSON.parse(raw) as { at: number; payload: ReactionPayload };
        return Date.now() - at <= maxAgeMs ? payload : null;
    } catch {
        return null;
    }
}