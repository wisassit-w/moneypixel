import type { ReactNode } from "react";

const tones = {
    sage: "bg-emerald-50 text-emerald-800",
    amber: "bg-amber-100/80 text-amber-800 border border-amber-200",
    clay: "bg-orange-50 text-orange-800",
    stone: "bg-stone-100 text-stone-600",
} as const;

const dots = { ok: "bg-emerald-500", warn: "bg-amber-500", over: "bg-rose-500" } as const;

type Props = {
    label: ReactNode; // string or <T k="..." />
    value: ReactNode;
    icon: ReactNode; // lucide icon element, e.g. <Coins className="w-5 h-5" />
    tone?: keyof typeof tones;
    progress?: number; // 0-100, shows a mini progress bar (used for EXP)
    hint?: ReactNode; // small line under the value, e.g. "20/100 EXP"
    status?: keyof typeof dots; // coloured dot in front of the hint
};

export default function StatCard({ label, value, icon, tone = "sage", progress, hint, status }: Props) {
    return (
        <div className="flex items-center gap-4 rounded-2xl border border-stone-100 bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</div>
            <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
                <p className="break-words text-2xl font-bold leading-tight tabular-nums text-stone-800">{value}</p>
                {progress !== undefined && (
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-stone-100">
                        <div
                            className="h-full rounded-full bg-sage-600 transition-all duration-500"
                            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                        />
                    </div>
                )}
                {hint && (
                    <p className="mt-1 flex items-start gap-1.5 text-sm font-medium tabular-nums text-stone-500">
                        {status && <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dots[status]}`} />}
                        <span>{hint}</span>
                    </p>
                )}
            </div>
        </div>
    );
}