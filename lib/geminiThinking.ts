import type { GenerationConfig } from "@google/generative-ai";

// Gemini models "think" before answering, and that is ON by default. Reading a receipt does not need
// it, but it can add 20-40 seconds. These helpers dial it down per model family.
// @google/generative-ai has no type for thinkingConfig, but it forwards generationConfig to the API as-is.

export type ThinkingEffort = "fast" | "balanced";

export function thinkingConfigFor(model: string, effort: ThinkingEffort): Record<string, unknown> | undefined {
    // Gemini 2.5: a token budget. 0 switches thinking off (Flash and Flash-Lite only; Pro can't)
    if (/2\.5/.test(model)) {
        return /pro/.test(model) ? undefined : { thinkingBudget: effort === "fast" ? 0 : 512 };
    }

    // Gemini 3: a level. Thinking can't be fully disabled; "minimal" is the cheapest but not every model
    // accepts it (e.g. 3.8 Flash), so "low" is the safe choice for those and for *-latest aliases.
    // thinkingLevel and thinkingBudget must never be sent together.
    const minimalOk = /lite/.test(model) || /3\.[56]/.test(model);
    return { thinkingLevel: effort === "fast" && minimalOk ? "minimal" : "low" };
}

/** generationConfig with the thinking setting for this model added. */
export function withThinkingConfig(model: string, base: GenerationConfig, effort: ThinkingEffort): GenerationConfig {
    const thinking = thinkingConfigFor(model, effort);
    return thinking ? ({ ...base, thinkingConfig: thinking } as GenerationConfig) : base;
}

/** The API answered 400 because it didn't like the thinking setting: retry the same model without it. */
export function isThinkingConfigError(err: unknown): boolean {
    const e = err as { status?: unknown; message?: string } | null;
    return e?.status === 400 && /thinking/i.test(e?.message ?? "");
}