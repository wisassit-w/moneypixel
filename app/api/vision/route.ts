import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { auth } from "@/auth";
import { CATEGORIES } from "@/lib/categories";
import { isThinkingConfigError, withThinkingConfig } from "@/lib/geminiThinking";
import { rateLimit } from "@/lib/rateLimit";
import { createScanToken } from "@/lib/scanToken";
import type { Lang } from "@/lib/translations";

// NOTE: this is a normal API Route Handler. It must NOT contain "use server".
export const maxDuration = 60; // seconds; only matters on hosts with function time limits (e.g. Vercel)

// MONEYPIXEL CORE FEATURE: AI Receipt & Food Scanner.
// The browser POSTs JSON { image: <base64 or Data URL>, mimeType?, lang? }; Gemini vision reads the photo and
// we return { name, category, amount, estimated, token }.
//
// SPEED: (1) thinking is dialed down (it was the cause of 20-40 s scans), (2) fast Flash-Lite models go first,
// (3) HEDGING: if a model hasn't answered after HEDGE_MS, the next model is started in parallel and the first
// valid answer wins; the rest are cancelled. A stuck model now costs seconds, not the whole budget.

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

const ATTEMPT_MS = 18_000; // one model gets at most this long
const HEDGE_MS = 6_000; // no answer after this long: also ask the next model
const TOTAL_MS = 30_000; // give up after this long
const MAX_PARALLEL = 3;

const EXPENSE_CATEGORIES = Object.entries(CATEGORIES)
    .filter(([, c]) => c.type === "expense")
    .map(([name]) => name);

// If the model answers with a generic name, map it to a category the app really has.
const CATEGORY_ALIASES: Record<string, string> = {
    housing: "Dorm & Bills",
    rent: "Dorm & Bills",
    utilities: "Dorm & Bills",
    bills: "Dorm & Bills",
    dorm: "Dorm & Bills",
    food: "Food & Drinks",
    drinks: "Food & Drinks",
    shopping: "Books/Stationery",
    books: "Books/Stationery",
    stationery: "Books/Stationery",
    entertainment: "Gaming/Hangout",
    games: "Gaming/Hangout",
    gaming: "Gaming/Hangout",
    hangout: "Gaming/Hangout",
    travel: "Transport",
    taxi: "Transport",
};

function normalizeCategory(value: unknown): string {
    const raw = String(value ?? "").trim();
    if (EXPENSE_CATEGORIES.includes(raw)) return raw;
    return CATEGORY_ALIASES[raw.toLowerCase()] ?? "Food & Drinks"; // the user can change it in the form before saving
}

const MESSAGES = {
    th: {
        invalid: "คำขอไม่ถูกต้อง (อ่านข้อมูลที่ส่งมาไม่ได้)",
        noImage: "กรุณาเลือกรูปภาพ",
        badType: "รองรับเฉพาะรูป JPG, PNG หรือ WebP",
        badImage: "ข้อมูลรูปภาพไม่ถูกต้อง ลองเลือกรูปใหม่",
        tooBig: "รูปใหญ่เกินไป (สูงสุด 4 MB)",
        notConfigured: "ผู้ช่วย AI ยังไม่ได้ตั้งค่า เพิ่ม GEMINI_API_KEY ในไฟล์ .env แล้วรีสตาร์ตเซิร์ฟเวอร์",
        unreadable: "ไม่พบใบเสร็จหรืออาหารในรูปนี้ ลองถ่ายให้ชัดขึ้นอีกครั้ง",
        key: "Gemini ปฏิเสธ API key ตรวจสอบ GEMINI_API_KEY ในไฟล์ .env แล้วรีสตาร์ตเซิร์ฟเวอร์",
        blocked: "ระบบความปลอดภัยของ Gemini บล็อกรูปนี้ ลองใช้รูปอื่น",
        quota: "AI ใช้งานเกินโควตาหรืออัตราที่กำหนด รอสักครู่แล้วลองใหม่",
        busy: "AI มีผู้ใช้งานจำนวนมากในขณะนี้ กรุณาลองอีกครั้งในอีกสักครู่",
        notFound: "Gemini หาโมเดลสำหรับคีย์นี้ไม่พบ ตั้งค่า GEMINI_VISION_MODEL ใน .env",
        timeout: "AI ตอบช้าเกินไป กรุณาลองใหม่",
        unavailable: "บริการ AI ใช้งานไม่ได้ชั่วคราว กรุณาลองใหม่อีกครั้ง",
        internal: "เซิร์ฟเวอร์ผิดพลาด กรุณาลองใหม่ (ดูรายละเอียดในเทอร์มินัล)",
    },
    en: {
        invalid: "Invalid request (the data sent couldn't be read).",
        noImage: "Please choose an image.",
        badType: "Only JPG, PNG or WebP images are supported.",
        badImage: "The image data isn't valid. Please pick the photo again.",
        tooBig: "That image is too large (max 4 MB).",
        notConfigured:
            "The AI assistant isn't set up yet. Add GEMINI_API_KEY to your .env file and restart the dev server.",
        unreadable: "I couldn't find a receipt or food in that photo. Try a clearer one.",
        key: "Gemini rejected the API key. Check GEMINI_API_KEY in your .env file, then restart the dev server.",
        blocked: "Gemini's safety filters blocked that photo. Try another one.",
        quota: "The AI has hit its rate or quota limit. Please wait a minute and try again.",
        busy: "The AI is very busy right now. Please try again in a few seconds.",
        notFound: "Gemini couldn't find the model for this key. Set GEMINI_VISION_MODEL in .env.",
        timeout: "The AI took too long to respond. Please try again.",
        unavailable: "The AI service is unavailable right now. Please try again in a moment.",
        internal: "Server error. Please try again (details are in the terminal).",
    },
} satisfies Record<Lang, Record<string, string>>;

type Msgs = (typeof MESSAGES)["th"];

// Strict-JSON instruction: no markdown, no code fences, no extra text
const INSTRUCTION = [
    "You read receipts, bank transfer slips and food photos for MoneyPixel, a student finance app in Thailand.",
    "Respond ONLY with one raw JSON object. No markdown, no code blocks, no explanation, no extra text.",
    'Exact shape: {"name": "ชื่อรายการ/คนรับเงิน", "category": "Food & Drinks", "amount": 150, "estimated": false}',
    "- name: the merchant, the dish, or for a bank transfer slip the RECIPIENT's name. Short (max 40 characters), in the language shown in the photo (Thai or English).",
    "- amount: the TOTAL paid in Thai baht as a plain number, no currency symbol and no commas.",
    "  For a receipt use the grand total. For a transfer slip use the transferred amount (ignore the fee).",
    "  If the photo is food with no price visible, estimate a typical canteen / street-food price in Thailand in baht and set estimated=true.",
    `- category: the best match from this list only: ${EXPENSE_CATEGORIES.map((c) => `"${c}"`).join(", ")}.`,
    "- estimated: true only when you guessed the price; false when the price was read from the image.",
    'If the image is none of these, respond with {"name":"","category":"Food & Drinks","amount":0,"estimated":false}.',
    "Never invent items.",
].join("\n");

// ---------- helpers ----------
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

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

/** One short log line instead of a full stack trace */
const brief = (err: unknown) =>
    `${errStatus(err) ?? "ERR"} ${errMessage(err)
        .replace(/^\[GoogleGenerativeAI Error\]:\s*/, "")
        .replace(/https?:\/\/\S+/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 140)}`;

function friendlyError(err: unknown, m: Msgs): { status: number; message: string } {
    if (isKeyError(err)) return { status: 401, message: m.key };
    if (isBlocked(err)) return { status: 422, message: m.blocked };

    const status = errStatus(err);
    if (status === 429) return { status: 429, message: m.quota };
    if (status === 503) return { status: 503, message: m.busy };
    if (status === 404) return { status: 502, message: m.notFound };
    if (/timeout|timed out|aborted/i.test(errMessage(err))) return { status: 504, message: m.timeout };
    return { status: 502, message: m.unavailable };
}

/** The error worth showing: skip "model not found" and our own aborts when something more useful exists. */
function pickError(errors: unknown[]): unknown {
    return (
        errors.find((e) => errStatus(e) !== 404 && !/abort/i.test(errMessage(e))) ??
        errors.find((e) => errStatus(e) !== 404) ??
        errors[errors.length - 1] ??
        new Error("timeout")
    );
}

/**
 * Fast models first. Flash-Lite is plenty for reading a receipt and answers much sooner.
 * Set GEMINI_VISION_MODEL in .env to force your own first choice.
 */
function modelChain(): string[] {
    return Array.from(
        new Set(
            [
                process.env.GEMINI_VISION_MODEL,
                "gemini-3.5-flash-lite",
                "gemini-3.1-flash-lite",
                "gemini-3.5-flash",
                "gemini-flash-latest",
                "gemini-3.6-flash",
                process.env.GEMINI_MODEL, // the chat model: last, it may be slower
            ].filter((x): x is string => !!x),
        ),
    );
}

/** If the Data URL header is missing, guess the type from the first bytes of the base64. */
function sniffMime(base64: string): string | null {
    if (base64.startsWith("/9j/")) return "image/jpeg";
    if (base64.startsWith("iVBOR")) return "image/png";
    if (base64.startsWith("UklGR")) return "image/webp";
    return null;
}

// ---------- reading the AI answer ----------
type Scan = { name: string; category: string; amount: number; estimated: boolean };

/** Parses the model output (even if it wrapped the JSON in a code block) and validates every field. */
function parseScan(text: string): Scan | null {
    const cleaned = text.trim().replace(/^```(?:json)?\s*|\s*```$/gi, "");
    const block = cleaned.match(/\{[\s\S]*\}/)?.[0] ?? cleaned;

    let obj: Record<string, unknown>;
    try {
        obj = JSON.parse(block) as Record<string, unknown>;
    } catch {
        return null;
    }

    const amount = Math.round(Number(String(obj.amount ?? "").replace(/[^\d.]/g, "")) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0 || amount > 99_999_999) return null;

    return {
        name: String(obj.name ?? "").trim().slice(0, 60),
        category: normalizeCategory(obj.category),
        amount,
        estimated: obj.estimated === true,
    };
}

// ---------- asking Gemini ----------
type ImagePart = { inlineData: { data: string; mimeType: string } };
type Answer = { kind: "scan"; scan: Scan } | { kind: "unreadable" };

/** One model, one request. Thinking is dialed down; if the API rejects that setting, retry without it. */
async function askModel(genAI: GoogleGenerativeAI, name: string, image: ImagePart, signal: AbortSignal): Promise<Answer> {
    const run = async (useThinkingConfig: boolean) => {
        const base = { temperature: 0.1, maxOutputTokens: 1024, responseMimeType: "application/json" };
        const model = genAI.getGenerativeModel({
            model: name,
            // JSON mode: the model must answer with parseable JSON only
            generationConfig: useThinkingConfig ? withThinkingConfig(name, base, "fast") : base,
        });
        const result = await model.generateContent([INSTRUCTION, image], { timeout: ATTEMPT_MS, signal });
        return parseScan(result.response.text());
    };

    let scan: Scan | null;
    try {
        scan = await run(true);
    } catch (err) {
        if (!signal.aborted && isThinkingConfigError(err)) scan = await run(false);
        else throw err;
    }
    return scan ? { kind: "scan", scan } : { kind: "unreadable" };
}

type Outcome =
    | { kind: "scan"; scan: Scan; model: string; ms: number }
    | { kind: "unreadable" }
    | { kind: "error"; error: unknown };

/**
 * Hedged race: start the first model; if it hasn't answered after HEDGE_MS (or it fails),
 * start the next one while the first keeps running. First valid answer wins, the rest are aborted.
 */
function raceModels(genAI: GoogleGenerativeAI, models: string[], image: ImagePart): Promise<Outcome> {
    return new Promise((resolve) => {
        const started = Date.now();
        const controllers: AbortController[] = [];
        const errors: unknown[] = [];
        const failures: string[] = [];
        let next = 0;
        let active = 0;
        let settled = false;
        let hedgeTimer: ReturnType<typeof setTimeout> | undefined;
        let deadlineTimer: ReturnType<typeof setTimeout> | undefined;

        const finish = (outcome: Outcome) => {
            if (settled) return;
            settled = true;
            clearTimeout(hedgeTimer);
            clearTimeout(deadlineTimer);
            controllers.forEach((c) => c.abort()); // stop the models that are still working
            if (outcome.kind === "error") console.error(`[vision] all attempts failed: ${failures.join(" | ")}`);
            resolve(outcome);
        };

        const launch = () => {
            if (settled || next >= models.length || active >= MAX_PARALLEL) return;
            const name = models[next++];
            const controller = new AbortController();
            controllers.push(controller);
            active++;
            const t0 = Date.now();

            askModel(genAI, name, image, controller.signal)
                .then((answer) => {
                    if (answer.kind === "scan") finish({ kind: "scan", scan: answer.scan, model: name, ms: Date.now() - started });
                    else finish({ kind: "unreadable" });
                })
                .catch((err) => {
                    if (settled) return; // we aborted it ourselves after another model won
                    active--;
                    failures.push(`${name} ${Date.now() - t0}ms ${brief(err)}`);
                    errors.push(err);

                    // a bad key or a blocked photo won't be fixed by another model
                    if (isKeyError(err) || isBlocked(err)) return finish({ kind: "error", error: err });

                    if (next < models.length) launch(); // this one failed: start the next model right away
                    else if (active === 0) finish({ kind: "error", error: pickError(errors) });
                });
        };

        const hedge = () => {
            if (settled) return;
            launch(); // slow, not failed: ask the next model as well
            if (next < models.length) hedgeTimer = setTimeout(hedge, HEDGE_MS);
        };

        deadlineTimer = setTimeout(() => finish({ kind: "error", error: pickError(errors) }), TOTAL_MS);
        launch();
        hedgeTimer = setTimeout(hedge, HEDGE_MS);
    });
}

// ---------- handler ----------
export async function POST(req: Request) {
    let lang: Lang = "th";

    try {
        // Login required: otherwise anyone could use the Gemini key
        const session = await auth();
        const userId = session?.user?.id;
        if (!userId) return fail("Unauthorized", 401);
        if (!rateLimit(`vision:${userId}`, 15, 60 * 60 * 1000).ok) return fail("Too many scans. Please try again later.", 429);

        // 1. Parse the JSON body safely
        let body: { image?: unknown; mimeType?: unknown; lang?: unknown };
        try {
            body = await req.json();
        } catch {
            console.error(`[vision] body is not valid JSON (content-type: ${req.headers.get("content-type") ?? "none"})`);
            return fail(MESSAGES.th.invalid, 400);
        }
        lang = body?.lang === "en" ? "en" : "th";
        const m = MESSAGES[lang];

        const imageValue = typeof body?.image === "string" ? body.image : "";
        if (!imageValue) return fail(m.noImage, 400);

        // 2. Strip the Data URL prefix: Gemini wants ONLY the base64 payload
        const cleanBase64 = imageValue.replace(/^data:image\/\w+;base64,/, "").replace(/\s/g, "");
        if (!cleanBase64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(cleanBase64)) return fail(m.badImage, 400);

        const headerMime = imageValue.match(/^data:(image\/[\w.+-]+);base64,/i)?.[1];
        const mimeType = (
            (typeof body.mimeType === "string" && body.mimeType) ||
            headerMime ||
            sniffMime(cleanBase64) ||
            "image/jpeg"
        )
            .toLowerCase()
            .replace("image/jpg", "image/jpeg");

        if (!ALLOWED.has(mimeType)) return fail(m.badType, 415);
        if (Math.floor((cleanBase64.length * 3) / 4) > MAX_BYTES) return fail(m.tooBig, 413);

        const apiKey = process.env.GEMINI_API_KEY?.trim();
        if (!apiKey) return fail(m.notConfigured, 503);

        // 3. Ask Gemini (fast models first, hedged)
        const image: ImagePart = { inlineData: { data: cleanBase64, mimeType } };
        const outcome = await raceModels(new GoogleGenerativeAI(apiKey), modelChain(), image);

        if (outcome.kind === "scan") {
            console.info(`[vision] ok model=${outcome.model} ${outcome.ms}ms`);
            // `token` = signed proof of a real scan; the server checks it before giving the +30 EXP AI bonus
            return NextResponse.json({ ...outcome.scan, token: createScanToken(userId) });
        }
        if (outcome.kind === "unreadable") return fail(m.unreadable, 422);

        const { status, message } = friendlyError(outcome.error, m);
        return fail(message, status);
    } catch (err) {
        // Last safety net: always answer with JSON so the form can show a readable message
        console.error("[vision] unexpected error:", err);
        return fail(MESSAGES[lang].internal, 500);
    }
}