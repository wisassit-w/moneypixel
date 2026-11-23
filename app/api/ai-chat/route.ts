import { GoogleGenerativeAI, type Content, type EnhancedGenerateContentResponse } from "@google/generative-ai";
import { formatCurrency } from "@/lib/format";
import { getMonthlySummary, type MonthlySummary } from "@/lib/summary";
import type { Lang } from "@/lib/translations";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rateLimit";

// ---------- localized error messages ----------
const MESSAGES = {
    th: {
        badJson: "คำขอไม่ถูกต้อง (อ่านข้อมูลที่ส่งมาไม่ได้)",
        empty: "กรุณาพิมพ์คำถามก่อน",
        notConfigured: "ผู้ช่วย AI ยังไม่ได้ตั้งค่า เพิ่ม GEMINI_API_KEY ในไฟล์ .env แล้วรีสตาร์ตเซิร์ฟเวอร์",
        key: "Gemini ปฏิเสธ API key ตรวจสอบ GEMINI_API_KEY ในไฟล์ .env แล้วรีสตาร์ตเซิร์ฟเวอร์",
        blocked: "ระบบความปลอดภัยของ Gemini บล็อกคำขอนี้ ลองเปลี่ยนคำถามดู",
        quota: "AI ใช้งานเกินโควตาหรืออัตราที่กำหนด รอสักครู่แล้วลองใหม่",
        busy: "AI มีผู้ใช้งานจำนวนมากในขณะนี้ กรุณาส่งข้อความอีกครั้งในอีกสักครู่",
        notFound: "Gemini หาโมเดลสำหรับคีย์นี้ไม่พบ ตั้งค่า GEMINI_MODEL ใน .env เป็นโมเดลที่คุณใช้ได้",
        timeout: "AI ตอบช้าเกินไป กรุณาลองใหม่",
        unavailable: "บริการ AI ใช้งานไม่ได้ชั่วคราว กรุณาลองใหม่อีกครั้ง",
        internal: "เซิร์ฟเวอร์ผิดพลาด กรุณาลองใหม่ (ดูรายละเอียดในเทอร์มินัล)",
        tried: "ลองแล้ว",
    },
    en: {
        badJson: "Invalid request (the data sent couldn't be read).",
        empty: "Please type a question first.",
        notConfigured:
            "The AI assistant isn't set up yet. Add GEMINI_API_KEY to your .env file and restart the dev server.",
        key: "Gemini rejected the API key. Check GEMINI_API_KEY in your .env file, then restart the dev server.",
        blocked: "Gemini's safety filters blocked that request. Try rephrasing it.",
        quota: "The AI has hit its rate or quota limit. Please wait a minute and try again.",
        busy: "The AI is very busy right now. Please send your message again in a few seconds.",
        notFound: "Gemini couldn't find the model for this key. Set GEMINI_MODEL in .env to a model you have access to.",
        timeout: "The AI took too long to respond. Please try again.",
        unavailable: "The AI service is unavailable right now. Please try again in a moment.",
        internal: "Server error. Please try again (details are in the terminal).",
        tried: "Tried",
    },
} satisfies Record<Lang, Record<string, string>>;

// ---------- helpers ----------
const jsonError = (error: string, status: number) => Response.json({ error }, { status });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function errStatus(err: unknown): number | undefined {
    const s = (err as { status?: unknown } | null)?.status;
    return typeof s === "number" ? s : undefined;
}

const errMessage = (err: unknown): string => (err as { message?: string } | null)?.message ?? "";

const isKeyError = (err: unknown) => {
    const status = errStatus(err);
    return status === 401 || status === 403 || (status === 400 && /api[_ ]?key/i.test(errMessage(err)));
};

const isBlocked = (err: unknown) => /blocked|safety|prohibited/i.test(errMessage(err));

function friendlyError(err: unknown, lang: Lang): { status: number; message: string } {
    const m = MESSAGES[lang];
    if (isKeyError(err)) return { status: 401, message: m.key };
    if (isBlocked(err)) return { status: 422, message: m.blocked };

    const status = errStatus(err);
    if (status === 429) return { status: 429, message: m.quota };
    if (status === 503) return { status: 503, message: m.busy };
    if (status === 404) return { status: 502, message: m.notFound };
    if (/timeout|timed out|aborted/i.test(errMessage(err))) return { status: 504, message: m.timeout };
    return { status: 502, message: m.unavailable };
}

const brief = (err: unknown) =>
    `${errStatus(err) ?? "ERR"} ${errMessage(err)
        .replace(/^\[GoogleGenerativeAI Error\]:\s*/, "")
        .replace(/https?:\/\/\S+/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 160)}`;

type Turn = { role: "user" | "model"; text: string };

const pickText = (...values: unknown[]): string | null => {
    for (const v of values) if (typeof v === "string" && v.trim()) return v.trim().slice(0, 2000);
    return null;
};

function readTurn(m: unknown): Turn | null {
    if (!m || typeof m !== "object") return null;
    const { role, content, text } = m as { role?: unknown; content?: unknown; text?: unknown };
    const body = pickText(content, text);
    const r = role === "assistant" || role === "model" ? "model" : role === "user" ? "user" : null;
    return r && body ? { role: r, text: body } : null;
}

function parsePayload(body: unknown): { prompt: string | null; history: Content[]; lang: Lang } {
    const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    const lang: Lang = b.lang === "en" ? "en" : "th";

    const list = Array.isArray(b.history) ? b.history : Array.isArray(b.messages) ? b.messages : [];
    const turns: Turn[] = [];
    for (const m of list.slice(-13)) {
        const t = readTurn(m);
        if (t) turns.push(t);
    }

    let prompt = pickText(b.prompt, b.message, b.text, b.question, b.input);
    const last = turns[turns.length - 1];
    if (last?.role === "user" && (!prompt || last.text === prompt)) {
        turns.pop();
        prompt = prompt ?? last.text;
    }

    const clean: Turn[] = [];
    for (const t of turns) {
        const prev = clean[clean.length - 1];
        if (prev && prev.role === t.role) prev.text += `\n${t.text}`;
        else if (prev || t.role === "user") clean.push({ ...t });
    }
    while (clean.length && clean[clean.length - 1].role === "user") clean.pop();

    return {
        prompt,
        history: clean.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
        lang,
    };
}

async function loadSummary(userId: string): Promise<MonthlySummary | null> {
    try {
        return await getMonthlySummary(userId);
    } catch (err) {
        console.error(`[ai-chat] could not load the monthly summary: ${brief(err)}`);
        return null;
    }
}

function buildSystemPrompt(summary: MonthlySummary | null, lang: Lang) {
    const data: string[] = [];
    if (summary) {
        data.push(
            `Month: ${summary.monthLabel}`,
            `Income so far: ${formatCurrency(summary.income)}`,
            `Spending so far: ${formatCurrency(summary.expense)}`,
            `Net (income minus spending): ${formatCurrency(summary.net)}`,
            `Savings rate: ${summary.savingsRate === null ? "not available (no income logged)" : `${summary.savingsRate}%`}`,
            `Top spending categories: ${summary.topCategories.map((c) => `${c.category} ${formatCurrency(c.amount)}`).join(", ") || "none yet"
            }`,
            `Transactions logged this month: ${summary.txCount}`,
        );
    } else {
        data.push("Spending data: not available right now.");
    }

    const languageRule =
        lang === "th"
            ? "LANGUAGE: Always reply in natural, friendly Thai (ภาษาไทย), even if the user writes in English. Write money as บาท."
            : "LANGUAGE: Always reply in clear, friendly English, even if the user writes in Thai. Write money in baht (THB).";

    return [
        'You are the "MoneyPixel Smart Financial Advisor", the AI advisor inside MoneyPixel, a finance + gamification app for university students in Thailand.',
        "",
        "YOUR JOBS:",
        "1. Analyze the user's spending using the real numbers below and point out what stands out.",
        "2. Give practical budget and saving advice for a student (allowance, dorm bills, food, transport, books, hangouts) with one or two concrete next steps.",
        "3. Explain or sanity-check prices from receipts and food photos when the user describes them. Never guess a price you can't see; ask the user to confirm.",
        "",
        "SCOPE: Only discuss money (spending, budgeting, saving, bills, income, the app's finance features). For anything else, decline politely in one short sentence and offer a finance topic instead.",
        languageRule,
        "STYLE: Plain text only, no markdown, no emojis. Keep answers under about 150 words. Short hyphen lists are fine. Be warm, encouraging and never shame the user for spending.",
        "HONESTY: Use only the numbers provided below. If data is missing, say so. Never invent transactions. You are not a licensed financial advisor; for big decisions (loans, investments) suggest a professional.",
        "",
        "User's finance data (private, use only if relevant):",
        ...data,
    ].join("\n");
}

function toStream(
    iterator: AsyncIterator<EnhancedGenerateContentResponse>,
    first: IteratorResult<EnhancedGenerateContentResponse>,
    model: string,
) {
    const encoder = new TextEncoder();

    const body = new ReadableStream<Uint8Array>({
        async start(controller) {
            try {
                let current = first;
                while (!current.done) {
                    const text = current.value.text();
                    if (text) controller.enqueue(encoder.encode(text));
                    current = await iterator.next();
                }
                controller.close();
            } catch (err) {
                console.error(`[ai-chat] stream interrupted: ${brief(err)}`);
                controller.error(err);
            }
        },
    });

    return new Response(body, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
            "X-AI-Model": model,
        },
    });
}

const ATTEMPT_TIMEOUT_MS = 12_000;
const TOTAL_BUDGET_MS = 25_000;
const RETRY_DELAY_MS = 1_000;

function modelChain(): string[] {
    return Array.from(
        new Set(
            [
                process.env.GEMINI_MODEL,
                "gemini-flash-latest",
                "gemini-3.5-flash",
                "gemini-2.5-flash",
                "gemini-3.5-flash-lite",
                "gemini-3.1-flash-lite",
                "gemini-3.8-flash",
            ].filter((x): x is string => !!x),
        ),
    );
}

export async function POST(req: Request) {
    let lang: Lang = "th";

    try {
        const session = await auth();
        if (!session?.user?.id) return jsonError("Unauthorized", 401);
        const userId = session.user.id;

        // Rate Limit: 40 messages per 10 minutes
        const limit = rateLimit(`chat:${userId}`, 40, 10 * 60 * 1000);
        if (!limit.ok) {
            return jsonError(lang === "th" ? "ใช้งานบ่อยเกินไป รอสักครู่แล้วลองใหม่" : "Too many requests. Please wait a moment.", 429);
        }

        const raw = await req.text();
        let body: unknown = null;
        try {
            body = raw ? JSON.parse(raw) : null;
        } catch {
            console.error(
                `[ai-chat] request body is not valid JSON (content-type: ${req.headers.get("content-type") ?? "none"}, ${raw.length} chars)`,
            );
            return jsonError(MESSAGES.th.badJson, 400);
        }

        const parsed = parsePayload(body);
        lang = parsed.lang;
        const m = MESSAGES[lang];

        if (!parsed.prompt) {
            console.error(`[ai-chat] no prompt found in the payload (keys: ${Object.keys((body as object) ?? {}).join(", ") || "none"})`);
            return jsonError(m.empty, 400);
        }

        const apiKey = process.env.GEMINI_API_KEY?.trim();
        if (!apiKey) return jsonError(m.notConfigured, 503);

        const system = buildSystemPrompt(await loadSummary(userId), lang);
        const genAI = new GoogleGenerativeAI(apiKey);
        const models = modelChain();

        const deadline = Date.now() + TOTAL_BUDGET_MS;
        const failures: string[] = [];
        let reported: unknown;

        outer: for (const name of models) {
            for (let attempt = 1; attempt <= 2; attempt++) {
                if (Date.now() > deadline) break outer;

                try {
                    const model = genAI.getGenerativeModel(
                        {
                            model: name,
                            systemInstruction: system,
                            generationConfig: { temperature: 0.6, maxOutputTokens: 2048 },
                        },
                        { timeout: ATTEMPT_TIMEOUT_MS },
                    );

                    const chat = model.startChat({ history: parsed.history });
                    const result = await chat.sendMessageStream(parsed.prompt);

                    const iterator = result.stream[Symbol.asyncIterator]();
                    const first = await iterator.next();
                    if (first.done) throw new Error("Empty response from Gemini");
                    first.value.text();

                    if (failures.length) console.info(`[ai-chat] ok on ${name} after: ${failures.join(" | ")}`);
                    return toStream(iterator, first, name);
                } catch (err) {
                    failures.push(`${name}#${attempt} ${brief(err)}`);

                    if (reported === undefined || errStatus(reported) === 404) reported = err;

                    if (isKeyError(err) || isBlocked(err)) break outer;

                    if (errStatus(err) === 503 && attempt === 1) {
                        await sleep(RETRY_DELAY_MS);
                        continue;
                    }
                    break;
                }
            }
        }

        console.error(`[ai-chat] all models failed: ${failures.join(" | ")}`);
        const { status, message } = friendlyError(reported, lang);
        const detail = errStatus(reported) === 404 ? ` (${m.tried}: ${models.join(", ")})` : "";
        return jsonError(message + detail, status);
    } catch (err) {
        console.error("[ai-chat] unexpected error:", err);
        return jsonError(MESSAGES[lang].internal, 500);
    }
}