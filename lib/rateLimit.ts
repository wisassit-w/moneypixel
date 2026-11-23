// In-memory sliding window: fine for a single server or a demo.
// When you deploy to several servers, switch to a shared store (e.g. Upstash Redis).
const hits = new Map<string, number[]>();
const KEEP_MS = 2 * 60 * 60 * 1000; // forget keys idle for 2 hours (longest window used is 1 hour)
let lastPrune = 0;

function prune(now: number) {
    if (now - lastPrune < 60_000) return;
    lastPrune = now;
    for (const [key, times] of hits) {
        if (!times.some((t) => now - t < KEEP_MS)) hits.delete(key);
    }
}

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
    const now = Date.now();
    prune(now);
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

    if (recent.length >= limit) {
        hits.set(key, recent);
        return { ok: false, retryAfterSec: Math.ceil((windowMs - (now - recent[0])) / 1000) };
    }

    recent.push(now);
    hits.set(key, recent);
    return { ok: true, retryAfterSec: 0 };
}

/**
 * Best-effort client address. X-Forwarded-For can be spoofed unless a trusted proxy sets it,
 * so it is only used to throttle registrations, never as the sole login protection.
 */
export function clientIp(h: Headers): string {
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}