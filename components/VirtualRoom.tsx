"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { Footprints, PiggyBank, Shirt, ShoppingBag, Sparkles } from "lucide-react";
import WardrobeModal from "@/components/WardrobeModal";
import ShopModal from "@/components/ShopModal";
import PiggyBankModal from "@/components/PiggyBankModal";
import AIAssistantModal from "@/components/AIAssistantModal";
import { equipItem, petPet, setGender, sleepInBed, type RewardResult } from "@/app/actions/user";
import { useLanguage } from "@/context/LanguageContext";
import type { AvatarLook } from "@/lib/avatar";
import type { Gender, PetType, Slot } from "@/lib/catalog";
import { REACTION_EVENT, consumePendingReaction, type ReactionPayload } from "@/lib/reactionBus";
import { ROOM_OPEN_EVENT, isRoomTool } from "@/lib/roomTools";
import { addPopup, createFx, drawFx, spawnHearts, spawnSparks, spawnZ, type Fx } from "@/lib/roomFx";
import {
    BED_FRONT,
    H,
    HOME,
    HOTSPOTS,
    TREADMILL_POS,
    W,
    drawScene,
    type Furniture,
    type Hotspot,
} from "@/lib/roomDraw";
import type { Vars } from "@/lib/translations";

export type RoomProps = {
    gender: Gender;
    hatId: string;
    shirtId: string;
    pantsId: string;
    shoesId: string;
    owned: Record<Slot, string[]>;
    furniture: Furniture;
    pet: { type: PetType; name: string | null };
    savings: { name: string | null; target: number; current: number };
    coins: number;
};

const RUN_MS = 5000;
const SLEEP_MS = 4500;
const REACTION_MS = 3000; // sassy / cheering messages float above the avatar for 3 seconds

type TFn = (key: string, vars?: Vars) => string;
type Act = { kind: "idle" | "run" | "sleep"; startedAt: number | null };

function toLogical(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
        x: ((e.clientX - rect.left) / rect.width) * W,
        y: ((e.clientY - rect.top) / rect.height) * H,
    };
}

function hitTest(p: { x: number; y: number }, f: Furniture, hasPet: boolean): Hotspot | null {
    const inside = (k: Hotspot) => {
        const r = HOTSPOTS[k];
        return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
    };
    if (f.desk && inside("monitor")) return "monitor";
    if (f.tv && inside("tv")) return "tv";
    if (f.treadmill && inside("treadmill")) return "treadmill";
    if (hasPet && inside("pet")) return "pet";
    if (inside("piggy")) return "piggy";
    if (f.bed && inside("bed")) return "bed";
    if (f.wardrobe && inside("wardrobe")) return "wardrobe";
    return null;
}

/** Floating "+15 EXP!" / "LEVEL UP!" popups for the result of a room action (sleep / pet). */
function showReward(fx: Fx, t: TFn, res: RewardResult, kind: "sleep" | "pet", at: { x: number; y: number }) {
    const now = performance.now();

    if (!res.ok) {
        addPopup(fx, t(res.error, res.vars), at.x, at.y, now, "#ffd1d1");
        return;
    }
    if (!res.rewarded) {
        addPopup(fx, t(kind === "sleep" ? "fx.notSleepy" : "fx.petHappy"), at.x, at.y, now, "#ffffff");
        return;
    }

    addPopup(fx, t("fx.exp", { n: res.expGained }), at.x, at.y, now, "#ffe08a");
    if (res.coinsGained > 0) addPopup(fx, t("fx.coins", { n: res.coinsGained }), at.x, at.y + 11, now + 300, "#ffd36e");
    if (kind === "sleep") addPopup(fx, t("fx.energyFull"), at.x, at.y + 11, now + 300, "#bfe8cf");

    if (res.leveledUp) {
        addPopup(fx, t("fx.levelUp"), 160, 46, now + 500, "#ffffff", true);
        spawnSparks(fx, 160, 54, now + 500);
    }
}

/**
 * MONEYPIXEL: finance reactions. After the user logs a transaction, deposits into the piggy bank
 * or claims a quest, the room shows a sassy (roast) or cheering message above the avatar for 3 seconds.
 */
function showReaction(fx: Fx, t: TFn, pos: { x: number; y: number }, p: ReactionPayload) {
    const now = performance.now();
    // keep the (wide) text inside the 320px canvas
    const x = Math.min(220, Math.max(100, pos.x + 8));
    const y = pos.y - 6;

    if (p.reaction) {
        const roast = p.reaction.tone === "roast";
        addPopup(fx, t(p.reaction.key, p.reaction.vars), x, y, now, roast ? "#ffb4a2" : "#bfe8cf", false, REACTION_MS);
        if (!roast) spawnSparks(fx, x, y + 6, now, 8);
    }
    if (p.expGained) addPopup(fx, t("fx.exp", { n: p.expGained }), x, y + 12, now + 400, "#ffe08a");
    if (p.coinsGained) addPopup(fx, t("fx.coins", { n: p.coinsGained }), x, y + 22, now + 700, "#ffd36e");

    if (p.leveledUp) {
        addPopup(fx, t("fx.levelUp"), 160, 46, now + 900, "#ffffff", true);
        spawnSparks(fx, 160, 54, now + 900);
    }
}

export default function VirtualRoom({
    gender,
    hatId,
    shirtId,
    pantsId,
    shoesId,
    owned,
    furniture,
    pet,
    savings,
    coins,
}: RoomProps) {
    const { t } = useLanguage();
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Animation state lives in refs so it survives re-renders and effect restarts
    const hoverRef = useRef<Hotspot | null>(null);
    const tvRef = useRef(false);
    const posRef = useRef({ x: HOME.x, y: HOME.y });
    const actRef = useRef<Act>({ kind: "idle", startedAt: null });
    const petRef = useRef<{ startedAt: number | null; busy: boolean }>({ startedAt: null, busy: false });
    const fxRef = useRef<Fx>(createFx());
    const lastZRef = useRef(0);
    const doneRef = useRef<() => void>(() => { });
    const sleepRef = useRef<() => void>(() => { });
    const tRef = useRef<TFn>(t);

    const [wardrobeOpen, setWardrobeOpen] = useState(false);
    const [shopOpen, setShopOpen] = useState(false);
    const [piggyOpen, setPiggyOpen] = useState(false);
    const [aiOpen, setAiOpen] = useState(false);
    const [running, setRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    // Sidebar shortcuts (Shop / Wardrobe / Piggy Bank): a same-page event, or /?open=shop from another page
    useEffect(() => {
        const open = (tool: string | null | undefined) => {
            if (!isRoomTool(tool)) return;
            if (tool === "wardrobe") setWardrobeOpen(true);
            else if (tool === "shop") setShopOpen(true);
            else if (tool === "piggy") setPiggyOpen(true);
            else setAiOpen(true);
        };

        const onEvent = (e: Event) => open((e as CustomEvent<string>).detail);
        window.addEventListener(ROOM_OPEN_EVENT, onEvent);

        let timer: number | undefined;
        const param = new URLSearchParams(window.location.search).get("open");
        if (param) {
            timer = window.setTimeout(() => open(param), 0);
            window.history.replaceState(null, "", window.location.pathname); // clean the URL
        }

        return () => {
            window.removeEventListener(ROOM_OPEN_EVENT, onEvent);
            window.clearTimeout(timer);
        };
    }, []);

    // Instant avatar update; settles to real server values once the action finishes
    const [look, setLook] = useOptimistic(
        { gender, hatId, shirtId, pantsId, shoesId } as AvatarLook,
        (current: AvatarLook, patch: Partial<AvatarLook>) => ({ ...current, ...patch }),
    );

    // Piggy bank size: savingsCurrent / savingsGoalTarget, clamped to 0..1
    const savingsPct = savings.target > 0 ? Math.min(1, Math.max(0, savings.current / savings.target)) : 0;

    useEffect(() => {
        tRef.current = t;
    }, [t]);

    useEffect(() => {
        // the treadmill run is just a room animation; stay on the dashboard
        doneRef.current = () => setRunning(false);
        // called once when the avatar has lain down in bed
        sleepRef.current = () => {
            startTransition(async () => {
                const res = await sleepInBed();
                showReward(fxRef.current, tRef.current, res, "sleep", { x: 82, y: 84 });
            });
        };
    }, [startTransition]);

    // Finance reactions from forms/modals (live event, or one saved while another page was open)
    useEffect(() => {
        const onReaction = (e: Event) => {
            consumePendingReaction(); // handled live: drop the stored copy
            showReaction(fxRef.current, tRef.current, posRef.current, (e as CustomEvent<ReactionPayload>).detail);
        };
        window.addEventListener(REACTION_EVENT, onReaction);

        const pending = consumePendingReaction();
        if (pending) showReaction(fxRef.current, tRef.current, posRef.current, pending);

        return () => window.removeEventListener(REACTION_EVENT, onReaction);
    }, []);

    const { bed, sofa, tv, treadmill, desk, wardrobe } = furniture;
    const petType = pet.type;

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        ctx.imageSmoothingEnabled = false;

        const furn: Furniture = { bed, sofa, tv, treadmill, desk, wardrobe };
        let frame = 0;
        let raf = 0;

        const loop = () => {
            frame++;
            const now = performance.now();
            const act = actRef.current;
            const pos = posRef.current;

            // walk toward the treadmill / bed while an action is active, otherwise back home
            const target = act.kind === "run" ? TREADMILL_POS : act.kind === "sleep" ? BED_FRONT : HOME;
            const dx = target.x - pos.x;
            const dy = target.y - pos.y;
            pos.x = Math.abs(dx) > 1 ? pos.x + Math.sign(dx) * Math.min(2.5, Math.abs(dx)) : target.x;
            pos.y = Math.abs(dy) > 1 ? pos.y + Math.sign(dy) : target.y;
            const atTarget = pos.x === target.x && pos.y === target.y;

            // arrived: start the timer (and trigger the server call for sleeping)
            if (act.kind !== "idle" && atTarget && act.startedAt === null) {
                act.startedAt = now;
                if (act.kind === "sleep") sleepRef.current();
            }

            const jogging = act.kind === "run" && atTarget;
            const sleeping = act.kind === "sleep" && atTarget;

            if (sleeping && now - lastZRef.current > 750) {
                spawnZ(fxRef.current, 80, 90, now);
                lastZRef.current = now;
            }

            // finish actions
            if (act.kind === "run" && act.startedAt !== null && now - act.startedAt >= RUN_MS) {
                actRef.current = { kind: "idle", startedAt: null };
                doneRef.current();
            } else if (act.kind === "sleep" && act.startedAt !== null && now - act.startedAt >= SLEEP_MS) {
                actRef.current = { kind: "idle", startedAt: null };
            }

            // pet bounce
            let petOffset = 0;
            const pf = petRef.current;
            if (pf.startedAt !== null) {
                const age = now - pf.startedAt;
                if (age > 1200) pf.startedAt = null;
                else petOffset = -Math.round(Math.abs(Math.sin(age / 110)) * 4 * (1 - age / 1200));
            }

            const animMoving = !atTarget || jogging;
            const bob = animMoving ? (Math.floor(frame / 5) % 2 === 0 ? 0 : -1) : Math.round(Math.sin(frame / 20));

            drawScene(ctx, {
                furniture: furn,
                pet: petType,
                petOffsetY: petOffset,
                look: {
                    gender: look.gender,
                    hatId: look.hatId,
                    shirtId: look.shirtId,
                    pantsId: look.pantsId,
                    shoesId: look.shoesId,
                },
                avatar: { x: pos.x, y: pos.y, bob, moving: animMoving },
                sleeping,
                savingsPct,
                tvOn: tvRef.current,
                beltRunning: jogging,
                hover: hoverRef.current,
                frame,
                overlay: (c) => drawFx(c, fxRef.current, now),
            });
            raf = requestAnimationFrame(loop);
        };
        loop();

        return () => cancelAnimationFrame(raf);
    }, [
        look.gender,
        look.hatId,
        look.shirtId,
        look.pantsId,
        look.shoesId,
        bed,
        sofa,
        tv,
        treadmill,
        desk,
        wardrobe,
        petType,
        savingsPct,
    ]);

    const idle = () => actRef.current.kind === "idle";

    function startRun() {
        if (!treadmill || !idle()) return;
        actRef.current = { kind: "run", startedAt: null };
        setRunning(true);
    }

    function startSleep() {
        if (!bed || !idle()) return;
        actRef.current = { kind: "sleep", startedAt: null };
    }

    function petThePet() {
        if (petType === "none" || petRef.current.busy) return;
        const now = performance.now();
        petRef.current = { startedAt: now, busy: true };
        spawnHearts(fxRef.current, 192, 134, now);

        startTransition(async () => {
            const res = await petPet();
            showReward(fxRef.current, tRef.current, res, "pet", { x: 195, y: 124 });
            petRef.current.busy = false;
        });
    }

    function handleEquip(slot: Slot, id: string) {
        const patch: Partial<AvatarLook> =
            slot === "hat" ? { hatId: id } : slot === "shirt" ? { shirtId: id } : slot === "pants" ? { pantsId: id } : { shoesId: id };
        setError(null);
        startTransition(async () => {
            setLook(patch);
            const res = await equipItem({ slot, itemId: id });
            if (!res.ok) setError(t(res.error, res.vars));
        });
    }

    function handleGender(g: Gender) {
        setError(null);
        startTransition(async () => {
            setLook({ gender: g });
            const res = await setGender(g);
            if (!res.ok) setError(t(res.error, res.vars));
        });
    }

    const overlayBtn =
        "inline-flex items-center gap-1.5 rounded-xl border border-stone-200/60 bg-card/90 px-3 py-1.5 text-xs font-semibold text-sage-ink shadow-sm backdrop-blur transition-all hover:bg-card hover:shadow-md active:scale-95";

    return (
        <div className="relative">
            <canvas
                ref={canvasRef}
                width={W}
                height={H}
                role="img"
                aria-label={t("app.name")}
                className="w-full rounded-xl"
                style={{ imageRendering: "pixelated" }}
                onMouseMove={(e) => {
                    const hit = hitTest(toLogical(e), furniture, petType !== "none");
                    hoverRef.current = hit;
                    e.currentTarget.style.cursor = hit ? "pointer" : "default";
                }}
                onMouseLeave={() => {
                    hoverRef.current = null;
                }}
                onClick={(e) => {
                    switch (hitTest(toLogical(e), furniture, petType !== "none")) {
                        case "wardrobe":
                            setWardrobeOpen(true);
                            break;
                        case "monitor":
                            setAiOpen(true);
                            break;
                        case "piggy":
                            setPiggyOpen(true);
                            break;
                        case "tv":
                            tvRef.current = !tvRef.current;
                            break;
                        case "treadmill":
                            startRun();
                            break;
                        case "bed":
                            startSleep();
                            break;
                        case "pet":
                            petThePet();
                            break;
                    }
                }}
            />

            <div className="absolute left-2 top-2 flex gap-1.5 sm:left-3 sm:top-3 sm:gap-2">
                <button onClick={() => setWardrobeOpen(true)} aria-label={t("room.wardrobe")} className={overlayBtn}>
                    <Shirt className="h-4 w-4" />
                    <span className="hidden sm:inline">{t("room.wardrobe")}</span>
                </button>
                <button onClick={() => setShopOpen(true)} aria-label={t("room.shop")} className={overlayBtn}>
                    <ShoppingBag className="h-4 w-4" />
                    <span className="hidden sm:inline">{t("room.shop")}</span>
                </button>
            </div>

            <div className="absolute right-2 top-2 flex gap-1.5 sm:right-3 sm:top-3 sm:gap-2">
                {treadmill && (
                    <button
                        onClick={startRun}
                        disabled={running}
                        aria-label={t("room.run")}
                        className={`${overlayBtn} disabled:opacity-60`}
                    >
                        <Footprints className="h-4 w-4" />
                        <span className="hidden sm:inline">{t("room.run")}</span>
                    </button>
                )}
                <button onClick={() => setAiOpen(true)} aria-label={t("room.askAi")} className={overlayBtn}>
                    <Sparkles className="h-4 w-4" />
                    <span className="hidden sm:inline">{t("room.askAi")}</span>
                </button>
            </div>

            <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3">
                <button onClick={() => setPiggyOpen(true)} aria-label={t("room.piggy")} className={overlayBtn}>
                    <PiggyBank className="h-4 w-4" />
                    <span className="hidden sm:inline">{t("room.piggy")}</span>
                </button>
            </div>

            {running && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-amber-200 bg-amber-100/90 px-4 py-1.5 text-xs font-semibold text-amber-800 shadow-sm">
                    {t("room.running")}
                </div>
            )}

            {wardrobeOpen && (
                <WardrobeModal
                    look={look}
                    owned={owned}
                    coins={coins}
                    pending={pending}
                    error={error}
                    onEquip={handleEquip}
                    onGender={handleGender}
                    onClose={() => setWardrobeOpen(false)}
                />
            )}

            <ShopModal
                open={shopOpen}
                onClose={() => setShopOpen(false)}
                shop={{
                    coins,
                    hasTv: furniture.tv,
                    hasSofa: furniture.sofa,
                    hasTreadmill: furniture.treadmill,
                    petType: pet.type,
                    petName: pet.name,
                }}
            />

            <PiggyBankModal open={piggyOpen} onClose={() => setPiggyOpen(false)} goal={savings} />

            {/* Always mounted so the chat history survives closing the drawer */}
            <AIAssistantModal open={aiOpen} onClose={() => setAiOpen(false)} />
        </div>
    );
}