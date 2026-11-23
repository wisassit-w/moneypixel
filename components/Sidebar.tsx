"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    ClipboardList,
    LayoutDashboard,
    Menu,
    PiggyBank,
    Shirt,
    ShoppingBag,
    Sofa,
    Sparkles,
    Wallet,
    X,
} from "lucide-react";
import LanguageToggle from "@/components/LanguageToggle";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import AIAssistantModal from "@/components/AIAssistantModal";
import { useLanguage } from "@/context/LanguageContext";
import { ROOM_OPEN_EVENT, type RoomTool } from "@/lib/roomTools";

const NAV = [
    { href: "/", key: "nav.dashboard", icon: LayoutDashboard },
    { href: "/finance", key: "nav.finance", icon: Wallet },
    { href: "/report", key: "dash.monthlyReport", icon: ClipboardList },
] as const;

const ROOM_TOOLS = [
    { tool: "shop", key: "room.shop", icon: ShoppingBag },
    { tool: "wardrobe", key: "room.wardrobe", icon: Shirt },
    { tool: "piggy", key: "room.piggy", icon: PiggyBank },
] as const;

const rowCls = "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition-all";
const idleCls = "font-medium text-stone-600 hover:translate-x-0.5 hover:bg-stone-50 hover:text-stone-800";
const activeCls = "bg-emerald-50 font-semibold text-emerald-800";

function Section({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="mb-5">
            <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
            <div className="flex flex-col gap-1">{children}</div>
        </div>
    );
}

export default function Sidebar({ userSlot }: { userSlot: ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { t } = useLanguage();
    const [menuOpen, setMenuOpen] = useState(false);
    const [aiOpen, setAiOpen] = useState(false);

    // The login page is a full-screen page without the app shell
    if (pathname === "/login") return null;

    // Shop / Wardrobe / Piggy Bank live in the room on the dashboard: open them there
    function openRoomTool(tool: RoomTool) {
        setMenuOpen(false);
        if (pathname === "/") window.dispatchEvent(new CustomEvent(ROOM_OPEN_EVENT, { detail: tool }));
        else router.push(`/?open=${tool}`);
    }

    // The same panel is used by the desktop sidebar and the phone drawer
    const panel = (
        <>
            <div className="mb-5 flex items-center gap-3 px-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-sage-ink">
                    <Sofa className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                    <h1 className="text-sm font-bold text-stone-800">{t("app.name")}</h1>
                    <p className="truncate text-xs text-stone-500">{t("app.tagline")}</p>
                </div>
            </div>

            <nav aria-label={t("nav.section.main")}>
                <Section label={t("nav.section.main")}>
                    {NAV.map(({ href, key, icon: Icon }) => {
                        const active = pathname === href;
                        return (
                            <Link
                                key={href}
                                href={href}
                                onClick={() => setMenuOpen(false)}
                                aria-current={active ? "page" : undefined}
                                className={`${rowCls} ${active ? activeCls : idleCls}`}
                            >
                                <Icon className="h-5 w-5 shrink-0" />
                                {t(key)}
                            </Link>
                        );
                    })}
                </Section>
            </nav>

            <Section label={t("nav.section.room")}>
                {ROOM_TOOLS.map(({ tool, key, icon: Icon }) => (
                    <button key={tool} onClick={() => openRoomTool(tool)} className={`${rowCls} ${idleCls}`}>
                        <Icon className="h-5 w-5 shrink-0" />
                        {t(key)}
                    </button>
                ))}
            </Section>

            <Section label={t("nav.section.ai")}>
                <button
                    onClick={() => {
                        setMenuOpen(false);
                        setAiOpen(true);
                    }}
                    className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-sage-600 p-3 text-left text-white shadow-sm transition-all hover:bg-sage-700 hover:shadow-md active:scale-[0.98]"
                >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                        <Sparkles className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                        <span className="block text-sm font-bold">{t("nav.askAi")}</span>
                        <span className="block text-xs text-white/80">{t("nav.aiAdvisor")}</span>
                    </span>
                </button>
            </Section>

            {/* pinned to the bottom: preferences, then the signed-in student */}
            <div className="mt-auto pt-2">
                <div className="mb-3 rounded-2xl border border-stone-100 bg-stone-50 p-3">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">{t("nav.section.prefs")}</p>
                    <div className="flex min-h-11 items-center justify-between gap-3">
                        <span className="text-sm font-medium text-stone-600">{t("lang.label")}</span>
                        <LanguageToggle />
                    </div>
                    <div className="flex min-h-11 items-center justify-between gap-3">
                        <span className="text-sm font-medium text-stone-600">{t("theme.label")}</span>
                        <ThemeSwitcher />
                    </div>
                </div>
                {userSlot}
            </div>
        </>
    );

    return (
        <>
            {/* Phone: top bar */}
            <header className="flex h-14 shrink-0 items-center justify-between border-b border-stone-200/60 bg-card px-3 md:hidden">
                <button
                    onClick={() => setMenuOpen(true)}
                    aria-label={t("nav.menu")}
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-stone-600 transition-colors hover:bg-stone-100"
                >
                    <Menu className="h-5 w-5" />
                </button>
                <span className="text-sm font-bold text-stone-800">{t("app.name")}</span>
                <button
                    onClick={() => setAiOpen(true)}
                    aria-label={t("nav.askAi")}
                    className="flex h-11 w-11 items-center justify-center rounded-xl bg-sage-600 text-white transition-colors hover:bg-sage-700"
                >
                    <Sparkles className="h-5 w-5" />
                </button>
            </header>

            {/* Desktop: fixed sidebar (scrolls on short screens) */}
            <aside className="hidden w-64 shrink-0 flex-col overflow-y-auto border-r border-stone-200/60 bg-card p-4 md:flex">
                {panel}
            </aside>

            {/* Phone: slide-in drawer, same panel */}
            {menuOpen && (
                <div className="fixed inset-0 z-40 md:hidden">
                    <div className="absolute inset-0 bg-scrim/30 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
                    <aside className="relative flex h-full w-72 max-w-[85vw] flex-col overflow-y-auto bg-card p-4 shadow-xl">
                        <button
                            onClick={() => setMenuOpen(false)}
                            aria-label={t("common.close")}
                            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100"
                        >
                            <X className="h-4 w-4" />
                        </button>
                        {panel}
                    </aside>
                </div>
            )}

            <AIAssistantModal open={aiOpen} onClose={() => setAiOpen(false)} />
        </>
    );
}