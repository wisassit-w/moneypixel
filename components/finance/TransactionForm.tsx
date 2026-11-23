"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Plus, ScanLine, Sparkles, Trash2, X } from "lucide-react";
import { addTransaction } from "@/app/finance/actions";
import { categoriesFor, type TxType } from "@/lib/categories";
import CategoryIcon from "@/components/CategoryIcon";
import { useLanguage } from "@/context/LanguageContext";
import { emitReaction } from "@/lib/reactionBus";

const inputCls =
    "rounded-2xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-800 outline-none transition-all focus:border-sage-ink/50 focus:bg-card focus:ring-4 focus:ring-emerald-50";

// Result of /api/vision (an AI-scanned receipt or food photo)
type ScanResult = { name: string; category: string; amount: number; estimated: boolean; token: string };

export default function TransactionForm() {
    const { t } = useLanguage();
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-sage-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sage-700 hover:shadow-md active:scale-95"
            >
                <Plus className="h-4 w-4" />
                {t("fin.add")}
            </button>
            {open && <TransactionModal onClose={() => setOpen(false)} />}
        </>
    );
}

function TransactionModal({ onClose }: { onClose: () => void }) {
    const { t } = useLanguage();
    const [type, setType] = useState<TxType>("expense");
    const [amount, setAmount] = useState("");
    const [category, setCategory] = useState("");
    const [description, setDescription] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    // AI Auto-Scan state. `scanToken` is the signed proof from /api/vision that unlocks the +30 EXP bonus.
    const [scanOpen, setScanOpen] = useState(false);
    const [scanToken, setScanToken] = useState<string | null>(null);
    const [scanEstimated, setScanEstimated] = useState(false);

    useEffect(() => {
        // while the scan dialog is open, Escape closes only that dialog
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && !scanOpen && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose, scanOpen]);

    function changeType(next: TxType) {
        setType(next);
        setCategory(""); // categories differ between income and expense
        if (next === "income") setScanToken(null); // the AI bonus is for scanned expenses only
    }

    /** Pre-fill the manual form with what the AI read from the photo. */
    function applyScan(r: ScanResult) {
        setType("expense");
        setAmount(String(r.amount));
        setCategory(r.category);
        setDescription(r.name);
        setScanToken(r.token);
        setScanEstimated(r.estimated);
        setScanOpen(false);
    }

    function clearScan() {
        setScanToken(null);
        setScanEstimated(false);
    }

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const fd = new FormData(e.currentTarget); // includes the hidden `scanToken` field
        setError(null);
        startTransition(async () => {
            const res = await addTransaction(fd);
            if (!res.ok) {
                setError(t(res.error, res.vars));
                return;
            }
            // the 2D room shows a sassy / cheering message above the avatar
            emitReaction({
                reaction: res.reaction,
                expGained: res.expGained,
                coinsGained: res.coinsGained,
                leveledUp: res.leveledUp,
            });
            onClose();
        });
    }

    const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD (local)

    return (
        <>
            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/30 p-4 backdrop-blur-sm"
                onClick={(e) => e.target === e.currentTarget && onClose()}
            >
                <form
                    onSubmit={handleSubmit}
                    className="max-h-[92vh] w-full max-w-md space-y-5 overflow-y-auto rounded-2xl border border-stone-100 bg-card p-6 text-stone-800 shadow-xl"
                >
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-stone-800">{t("fin.newTx")}</h3>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label={t("common.close")}
                            className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* AI Auto-Scan: opens a dialog to upload or paste a receipt / food photo */}
                    <div className="space-y-3">
                        <button
                            type="button"
                            onClick={() => setScanOpen(true)}
                            className="group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-sage-600 to-sage-700 p-4 text-left text-white shadow-md transition-all hover:shadow-lg active:scale-[0.99]"
                        >
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
                                <ScanLine className="h-6 w-6" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-1.5 text-sm font-bold">
                                    {t("fin.aiScan")}
                                    <Sparkles className="h-4 w-4 text-yellow-200" />
                                </span>
                                <span className="mt-0.5 block text-xs text-white/90">{t("fin.aiScanHint")}</span>
                            </span>
                            <span className="absolute right-3 top-3 rounded-full bg-amber-100/90 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                +30 EXP
                            </span>
                        </button>

                        {scanToken && (
                            <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3">
                                <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-sage-600 px-2 py-0.5 text-[10px] font-bold text-white">
                                    <Sparkles className="h-3 w-3" />
                                    {t("scan.badge")}
                                </span>
                                <div className="min-w-0 flex-1 text-xs leading-relaxed text-stone-600">
                                    <p>{t("scan.filled")}</p>
                                    {scanEstimated && <p className="mt-0.5 font-medium text-amber-800">{t("scan.estimated")}</p>}
                                </div>
                                <button
                                    type="button"
                                    onClick={clearScan}
                                    aria-label={t("scan.remove")}
                                    className="rounded-lg p-1 text-stone-400 transition-colors hover:bg-card hover:text-rose-600"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        )}

                        <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-stone-400">
                            <span className="h-px flex-1 bg-stone-200" />
                            {t("fin.orManual")}
                            <span className="h-px flex-1 bg-stone-200" />
                        </div>
                    </div>

                    {/* Manual entry (also the place to double-check what the AI filled in) */}
                    <input type="hidden" name="type" value={type} />
                    <input type="hidden" name="scanToken" value={scanToken ?? ""} />

                    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-stone-100 p-1">
                        {(["expense", "income"] as const).map((tp) => (
                            <button
                                key={tp}
                                type="button"
                                onClick={() => changeType(tp)}
                                className={`rounded-xl py-2 text-sm font-semibold transition-all ${type === tp
                                        ? tp === "income"
                                            ? "bg-card text-sage-ink shadow-sm"
                                            : "bg-card text-orange-800 shadow-sm"
                                        : "text-stone-500 hover:text-stone-700"
                                    }`}
                            >
                                {t(tp === "income" ? "fin.income" : "fin.expense")}
                            </button>
                        ))}
                    </div>

                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-stone-400">฿</span>
                        <input
                            name="amount"
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0.01"
                            required
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full rounded-2xl border border-stone-200 bg-stone-50 py-3 pl-10 pr-4 text-2xl font-semibold text-stone-800 outline-none transition-all placeholder:text-stone-300 focus:border-sage-ink/50 focus:bg-card focus:ring-4 focus:ring-emerald-50"
                        />
                    </div>

                    <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">{t("fin.category")}</p>
                        <div className="flex flex-wrap gap-2">
                            {categoriesFor(type).map(([name, cfg]) => (
                                <label key={name} className="cursor-pointer">
                                    <input
                                        type="radio"
                                        name="category"
                                        value={name}
                                        required
                                        checked={category === name}
                                        onChange={() => setCategory(name)}
                                        className="peer sr-only"
                                    />
                                    <span
                                        className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium opacity-70 transition-all hover:scale-[1.03] hover:opacity-100 peer-checked:opacity-100 peer-checked:ring-2 peer-checked:ring-sage-ink peer-focus-visible:ring-2 ${cfg.badge}`}
                                    >
                                        <CategoryIcon name={name} className="h-4 w-4" />
                                        {t(`cat.${name}`)}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <input
                            name="description"
                            maxLength={120}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder={t("fin.notePlaceholder")}
                            className={`col-span-2 sm:col-span-1 ${inputCls}`}
                        />
                        <input
                            name="date"
                            type="date"
                            defaultValue={today}
                            required
                            className={`col-span-2 sm:col-span-1 ${inputCls}`}
                        />
                    </div>

                    {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

                    <button
                        type="submit"
                        disabled={pending}
                        className="w-full rounded-2xl bg-sage-600 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sage-700 active:scale-[0.98] disabled:opacity-60"
                    >
                        {pending ? t("common.saving") : scanToken ? t("fin.saveRewardAi") : t("fin.saveReward")}
                    </button>
                </form>
            </div>

            {scanOpen && <ScanModal onClose={() => setScanOpen(false)} onResult={applyScan} />}
        </>
    );
}

/**
 * Shrinks the photo to max 1280px and returns it as a JPEG Data URL ("data:image/jpeg;base64,...").
 * Smaller uploads are faster and cheaper, and phone photos stay under the server's size limit.
 */
async function shrinkToDataUrl(file: File, maxSide = 1280): Promise<string> {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    return canvas.toDataURL("image/jpeg", 0.8); // ปรับคุณภาพลดลงเหลือ 0.8 เพื่อให้อัปโหลดเร็วขึ้น
}

/** Upload / paste a receipt or food photo, let Gemini read it, and hand the result back to the form. */
function ScanModal({ onClose, onResult }: { onClose: () => void; onResult: (r: ScanResult) => void }) {
    const { lang, t } = useLanguage();
    const inputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [busy, setBusy] = useState(false);
    const [slow, setSlow] = useState(false); // เพิ่มสถานะเช็คว่า AI กำลังทำงานช้า
    const [error, setError] = useState<string | null>(null);

    // free the temporary preview URL
    useEffect(() => {
        return () => {
            if (preview) URL.revokeObjectURL(preview);
        };
    }, [preview]);

    function pick(f: File | undefined | null) {
        if (!f) return;
        if (!f.type.startsWith("image/")) {
            setError(t("scan.notImage"));
            return;
        }
        setError(null);
        setFile(f);
        setPreview(URL.createObjectURL(f));
    }

    // Escape closes this dialog; Ctrl+V pastes a screenshot or copied photo
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        const onPaste = (e: ClipboardEvent) => {
            const img = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
            if (img) pick(img);
        };
        window.addEventListener("keydown", onKey);
        window.addEventListener("paste", onPaste);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("paste", onPaste);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onClose]);

    async function analyze() {
        if (!file || busy) return;
        setBusy(true);
        setSlow(false);
        setError(null);

        // หลังจากผ่านไป 7 วินาที แจ้งผู้ใช้ว่าระบบกำลังประมวลผลอยู่
        const slowTimer = setTimeout(() => setSlow(true), 7000);
        // กำหนด Timeout ที่ 40 วินาที เพื่อป้องกันค้างนานเกินไป
        const controller = new AbortController();
        const abortTimer = setTimeout(() => controller.abort(), 40_000);

        try {
            // 1. Shrink the photo and turn it into a base64 Data URL
            let image: string;
            try {
                image = await shrinkToDataUrl(file);
            } catch {
                setError(t("scan.readFail")); // e.g. a format the browser can't decode
                setBusy(false);
                return;
            }

            // 2. Plain JSON fetch (NOT a Server Action and NOT multipart, so Next can't mistake it for one)
            const res = await fetch("/api/vision", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image, mimeType: "image/jpeg", lang }),
                signal: controller.signal,
            });

            // Read as text first: a missing route returns an HTML page, and res.json() would throw a confusing error
            const raw = await res.text();
            let data: (Partial<ScanResult> & { error?: string }) | null = null;
            try {
                data = JSON.parse(raw);
            } catch {
                console.error(`[scan] /api/vision answered HTTP ${res.status} with a non-JSON body:`, raw.slice(0, 200));
            }

            if (!res.ok || !data || typeof data.amount !== "number" || !data.token) {
                throw new Error(data?.error ?? `${t("ai.errorGeneric")} (HTTP ${res.status})`);
            }

            onResult({
                name: data.name ?? "",
                category: data.category ?? "Food & Drinks",
                amount: data.amount,
                estimated: data.estimated === true,
                token: data.token,
            });
        } catch (err) {
            const aborted = err instanceof DOMException && err.name === "AbortError";
            setError(aborted ? t("ai.errorGeneric") : err instanceof Error ? err.message : t("ai.errorGeneric"));
            setBusy(false);
        } finally {
            clearTimeout(slowTimer);
            clearTimeout(abortTimer);
        }
    }

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim/40 p-4 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="w-full max-w-sm space-y-4 rounded-2xl border border-stone-100 bg-card p-6 text-stone-800 shadow-xl">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h3 className="flex items-center gap-2 text-lg font-bold">
                            <ScanLine className="h-5 w-5 text-sage-ink" />
                            {t("scan.title")}
                        </h3>
                        <p className="mt-0.5 text-sm text-stone-500">{t("scan.subtitle")}</p>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label={t("common.close")}
                        className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Hidden picker: capture="environment" opens the rear camera on phones */}
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                        pick(e.target.files?.[0]);
                        e.target.value = "";
                    }}
                />

                {preview ? (
                    <div className="relative overflow-hidden rounded-2xl border border-stone-100 bg-stone-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={preview} alt="" className="max-h-64 w-full object-contain" />
                        {!busy && (
                            <button
                                onClick={() => {
                                    setFile(null);
                                    setPreview(null);
                                }}
                                aria-label={t("scan.remove")}
                                className="absolute right-2 top-2 rounded-lg bg-card/90 p-1.5 text-stone-500 shadow-sm transition-colors hover:text-rose-600"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                ) : (
                    <div
                        onClick={() => inputRef.current?.click()}
                        onDragOver={(e) => {
                            e.preventDefault();
                            setDragOver(true);
                        }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setDragOver(false);
                            pick(e.dataTransfer.files[0]);
                        }}
                        className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition-all ${dragOver
                                ? "border-sage-ink bg-emerald-50"
                                : "border-stone-200 bg-cream hover:border-emerald-300 hover:bg-emerald-50/50"
                            }`}
                    >
                        <ScanLine className={`h-8 w-8 ${dragOver ? "text-sage-ink" : "text-stone-400"}`} />
                        <p className="text-sm font-medium text-stone-700">{t("scan.drop")}</p>
                    </div>
                )}

                {/* แสดงข้อความแจ้งเตือนเมื่อ AI ทำงานช้ากว่าปกติ */}
                {busy && slow && <p className="text-center text-xs text-stone-500">{t("scan.slow")}</p>}

                {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

                <button
                    onClick={analyze}
                    disabled={!file || busy}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sage-600 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sage-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {busy ? t("scan.analyzing") : t("scan.analyze")}
                </button>
            </div>
        </div>
    );
}