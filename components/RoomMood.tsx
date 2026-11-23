import type { ReactNode } from "react";
import { CloudRain, Hourglass, Sparkles, Sprout, type LucideIcon } from "lucide-react";
import { T } from "@/context/LanguageContext";
import type { RoomMood as Mood } from "@/lib/mood";

const FRAME: Record<Mood, string> = {
    calm: "border-stone-100",
    careful: "border-amber-200 ring-1 ring-amber-100",
    stressed: "border-rose-200 ring-1 ring-rose-100",
    proud: "border-emerald-200 ring-1 ring-emerald-100",
};

// a faint inner glow along the edges only: the middle of the room stays clean
const GLOW: Record<Mood, string> = {
    calm: "",
    careful: "shadow-[inset_0_0_56px_rgba(245,158,11,0.16)]",
    stressed: "shadow-[inset_0_0_56px_rgba(244,63,94,0.14)]",
    proud: "shadow-[inset_0_0_56px_rgba(78,110,88,0.2)]",
};

const ICONS: Record<Mood, LucideIcon> = {
    calm: Sprout,
    careful: Hourglass,
    stressed: CloudRain,
    proud: Sparkles,
};

/** The dashboard centerpiece: header (title, status line, main action), the room, and one mood caption. */
export default function RoomMood({ mood, header, children }: { mood: Mood; header: ReactNode; children: ReactNode }) {
    const Icon = ICONS[mood];
    return (
        <section className={`rounded-2xl border bg-card p-3 shadow-sm transition-all hover:shadow-md sm:p-4 ${FRAME[mood]}`}>
            {header}
            <div className="relative mt-3">
                {children}
                <div aria-hidden className={`pointer-events-none absolute inset-0 rounded-xl ${GLOW[mood]}`} />
            </div>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-sm font-medium text-stone-500">
                <Icon className="h-4 w-4 shrink-0 text-sage-ink" aria-hidden />
                <T k={`mood.${mood}`} />
            </p>
        </section>
    );
}