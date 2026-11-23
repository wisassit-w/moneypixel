"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, SendHorizontal, Sparkles, X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

type Msg = { role: "user" | "assistant"; content: string; model?: string; error?: boolean };

// AI FINANCE PIVOT: suggestion chips are all about money now.
const PRESET_KEYS = ["ai.chip1", "ai.chip2", "ai.chip3", "ai.chip4"] as const;

export default function AIAssistantModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { lang, t } = useLanguage();
    const [messages, setMessages] = useState<Msg[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    async function send(text: string) {
        const prompt = text.trim();
        if (!prompt || loading) return;

        const history = messages.filter((m) => !m.error).map(({ role, content }) => ({ role, content }));
        const next: Msg[] = [...messages, { role: "user", content: prompt }];
        setMessages(next);
        setInput("");
        setLoading(true);

        let acc = "";
        let model: string | undefined;

        try {
            // `lang` makes the advisor answer natively in Thai or English
            const res = await fetch("/api/ai-chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt, history, lang }),
            });

            if (!res.ok) {
                const data = (await res.json().catch(() => null)) as { error?: string } | null;
                throw new Error(data?.error ?? t("ai.errorGeneric"));
            }
            if (!res.body) throw new Error(t("ai.empty"));

            model = res.headers.get("X-AI-Model") ?? undefined;
            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                acc += decoder.decode(value, { stream: true });
                setMessages([...next, { role: "assistant", content: acc, model }]);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : t("ai.errorGeneric");
            setMessages([
                ...next,
                acc
                    ? { role: "assistant", content: `${acc}\n\n${t("ai.interrupted")}`, model }
                    : { role: "assistant", content: message, error: true },
            ]);
        } finally {
            setLoading(false);
        }
    }

    if (!open) return null;

    // Show the spinner only until the first streamed text arrives
    const waiting = loading && messages[messages.length - 1]?.role === "user";

    return (
        <div
            className="fixed inset-0 z-50 flex justify-end bg-scrim/30 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <aside className="flex h-full w-full max-w-md flex-col border-l border-stone-100 bg-card text-stone-800 shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-sage-ink">
                            <Sparkles className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-stone-800">{t("ai.title")}</h3>
                            <p className="text-xs text-stone-500">{t("ai.subtitle")}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label={t("common.close")}
                        className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 space-y-4 overflow-y-auto bg-cream px-5 py-5">
                    {messages.length === 0 && (
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sage-ink">
                                    <Bot className="h-4 w-4" />
                                </div>
                                <p className="rounded-2xl rounded-tl-md bg-card px-4 py-3 text-sm leading-relaxed text-stone-700 shadow-sm">
                                    {t("ai.hello")}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2 pl-11">
                                {PRESET_KEYS.map((key) => (
                                    <button
                                        key={key}
                                        onClick={() => send(t(key))}
                                        className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-left text-xs font-medium text-emerald-800 transition-all hover:bg-emerald-100 active:scale-95"
                                    >
                                        {t(key)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((m, i) =>
                        m.role === "user" ? (
                            <div key={i} className="flex justify-end">
                                <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-sage-600 px-4 py-2.5 text-sm text-white shadow-sm">
                                    {m.content}
                                </p>
                            </div>
                        ) : (
                            <div key={i} className="flex items-start gap-3">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sage-ink">
                                    <Bot className="h-4 w-4" />
                                </div>
                                <div className="max-w-[85%] space-y-1">
                                    <p
                                        className={`whitespace-pre-wrap rounded-2xl rounded-tl-md px-4 py-3 text-sm leading-relaxed shadow-sm ${m.error ? "bg-rose-50 text-rose-700" : "bg-card text-stone-700"
                                            }`}
                                    >
                                        {m.content}
                                    </p>
                                    {m.model && (
                                        <span className="inline-block rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500">
                                            {m.model}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ),
                    )}

                    {waiting && (
                        <div className="flex items-center gap-2 pl-11 text-sm text-stone-500">
                            <Loader2 className="h-4 w-4 animate-spin text-sage-ink" />
                            {t("common.thinking")}
                        </div>
                    )}
                    <div ref={bottomRef} />
                </div>

                {/* Input */}
                <div className="border-t border-stone-100 bg-card px-5 py-4">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            send(input);
                        }}
                        className="flex items-center gap-2"
                    >
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            maxLength={500}
                            placeholder={t("ai.placeholder")}
                            className="flex-1 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-800 outline-none transition-all placeholder:text-stone-400 focus:border-sage-ink/50 focus:bg-card focus:ring-4 focus:ring-emerald-50"
                        />
                        <button
                            type="submit"
                            disabled={loading || !input.trim()}
                            aria-label={t("ai.send")}
                            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sage-600 text-white shadow-sm transition-all hover:bg-sage-700 active:scale-90 disabled:opacity-50"
                        >
                            <SendHorizontal className="h-4 w-4" />
                        </button>
                    </form>

                    <p className="mt-3 text-[11px] text-stone-400">{t("ai.disclaimer")}</p>
                </div>
            </aside>
        </div>
    );
}