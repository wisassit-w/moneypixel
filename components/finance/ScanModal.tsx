"use client";

import { useEffect, useState } from "react";
import { Camera, ImagePlus, Loader2, ScanLine, Sparkles, Trash2, X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

// Result of /api/vision (an AI-scanned receipt or food photo)
export type ScanResult = { name: string; category: string; amount: number; estimated: boolean; token: string };

// Phones sometimes hand over a photo with an empty MIME type (HEIC from Photos, files from other apps): fall back to the extension.
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i;
const looksLikeImage = (f: File) => f.type.startsWith("image/") || (f.type === "" && IMAGE_EXT.test(f.name));

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };

/** Decodes a photo. createImageBitmap first (respects EXIF rotation); an <img> as the fallback for older mobile browsers and webviews. */
async function decode(file: File): Promise<Decoded> {
    if (typeof createImageBitmap === "function") {
        try {
            const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
            return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
        } catch {
            // some browsers reject the options or the format: try the <img> route below
        }
    }

    const url = URL.createObjectURL(file);
    try {
        const img = new Image();
        img.src = url;
        await img.decode(); // rejects when the browser can't read the format
        return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
    } catch (err) {
        URL.revokeObjectURL(url);
        throw err;
    }
}

/**
 * Shrinks the photo to max 1280px and returns it as a JPEG Data URL ("data:image/jpeg;base64,...").
 * Smaller uploads are faster and cheaper, and phone photos stay under the server's size limit.
 */
async function shrinkToDataUrl(file: File, maxSide = 1280): Promise<string> {
    const img = await decode(file);
    try {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("canvas unavailable");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img.source, 0, 0, w, h);

        return canvas.toDataURL("image/jpeg", 0.8); // quality 0.8 keeps the upload fast
    } finally {
        img.release();
    }
}

const pickBtn =
    "flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl px-3 text-sm font-semibold shadow-sm transition-all active:scale-[0.98] focus-within:ring-2 focus-within:ring-sage-ink/50 focus-within:ring-offset-2 focus-within:ring-offset-card";

/** Upload / take / paste a receipt or food photo, let Gemini read it, and hand the result back to the form. */
export default function ScanModal({ onClose, onResult }: { onClose: () => void; onResult: (r: ScanResult) => void }) {
    const { lang, t } = useLanguage();
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [previewFailed, setPreviewFailed] = useState(false); // e.g. a HEIC photo this browser can't draw
    const [dragOver, setDragOver] = useState(false);
    const [busy, setBusy] = useState(false);
    const [slow, setSlow] = useState(false); // the AI is taking longer than usual
    const [error, setError] = useState<string | null>(null);

    // free the temporary preview URL
    useEffect(() => {
        return () => {
            if (preview) URL.revokeObjectURL(preview);
        };
    }, [preview]);

    function pick(f: File | undefined | null) {
        if (!f) return;
        if (!looksLikeImage(f)) {
            setError(t("scan.notImage"));
            return;
        }
        setError(null);
        setPreviewFailed(false);
        setFile(f);
        setPreview(URL.createObjectURL(f));
    }

    // Escape closes this dialog; Ctrl+V pastes a screenshot or copied photo (desktop)
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        const onPaste = (e: ClipboardEvent) => {
            const img = Array.from(e.clipboardData?.files ?? []).find(looksLikeImage);
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

        // after 7 seconds, tell the user the system is still working
        const slowTimer = setTimeout(() => setSlow(true), 7000);
        // give up after 40 seconds so the dialog never hangs
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
            <div className="max-h-[92vh] w-full max-w-sm space-y-4 overflow-y-auto rounded-2xl border border-stone-100 bg-card p-6 text-stone-800 shadow-xl">
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
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {preview ? (
                    <div className="relative overflow-hidden rounded-2xl border border-stone-100 bg-stone-50">
                        {previewFailed ? (
                            <p className="px-4 py-10 text-center text-sm font-medium text-stone-600 break-all">{file?.name}</p>
                        ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={preview} alt="" className="max-h-64 w-full object-contain" onError={() => setPreviewFailed(true)} />
                        )}
                        {!busy && (
                            <button
                                onClick={() => {
                                    setFile(null);
                                    setPreview(null);
                                }}
                                aria-label={t("scan.remove")}
                                className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-lg bg-card/90 text-stone-500 shadow-sm transition-colors hover:text-rose-600"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                ) : (
                    // Drag and drop (desktop) around two clear buttons. Each button is a <label> with a visually-hidden
                    // (sr-only) input inside it: tapping the label opens the picker natively, which is the pattern that
                    // works in iOS Safari and in-app browsers where a display:none input or a scripted .click() can fail.
                    <div
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
                        className={`space-y-4 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-all ${dragOver ? "border-sage-ink bg-emerald-50" : "border-stone-200 bg-cream"
                            }`}
                    >
                        <ScanLine className={`mx-auto h-8 w-8 ${dragOver ? "text-sage-ink" : "text-stone-400"}`} />
                        <p className="text-sm font-medium text-stone-700">{t("scan.dropHint")}</p>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {/* Gallery / Photos / Files: no `capture`, so the phone offers its photo library */}
                            <label className={`${pickBtn} border border-stone-200 bg-card text-stone-700 hover:bg-stone-50`}>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="sr-only"
                                    onChange={(e) => {
                                        pick(e.target.files?.[0]);
                                        e.target.value = ""; // lets the same photo be chosen again
                                    }}
                                />
                                <ImagePlus className="h-5 w-5 text-sage-ink" />
                                {t("scan.gallery")}
                            </label>

                            {/* Camera: capture="environment" opens the rear camera directly */}
                            <label className={`${pickBtn} border border-transparent bg-sage-600 text-white hover:bg-sage-700`}>
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="sr-only"
                                    onChange={(e) => {
                                        pick(e.target.files?.[0]);
                                        e.target.value = "";
                                    }}
                                />
                                <Camera className="h-5 w-5" />
                                {t("scan.camera")}
                            </label>
                        </div>
                    </div>
                )}

                {busy && slow && <p className="text-center text-xs text-stone-500">{t("scan.slow")}</p>}

                {error && (
                    <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        {error}
                    </p>
                )}

                <button
                    onClick={analyze}
                    disabled={!file || busy}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-sage-600 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sage-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {busy ? t("scan.analyzing") : t("scan.analyze")}
                </button>
            </div>
        </div>
    );
}