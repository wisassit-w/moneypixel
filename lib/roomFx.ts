import { getItem } from "@/lib/catalog";
import { shade, type AvatarLook } from "@/lib/avatar";

export type Particle = {
    kind: "heart" | "zzz" | "spark";
    x: number;
    y: number;
    vx: number; // px per second
    vy: number;
    born: number; // ms (performance.now); may be in the future to stagger spawns
    life: number; // ms
    size: number;
    color?: string;
};

export type Popup = {
    text: string;
    x: number;
    y: number;
    born: number;
    life: number;
    color: string;
    big?: boolean;
};

export type Fx = { particles: Particle[]; popups: Popup[] };

export const createFx = (): Fx => ({ particles: [], popups: [] });

export function spawnHearts(fx: Fx, x: number, y: number, now: number, count = 6) {
    for (let i = 0; i < count; i++) {
        fx.particles.push({
            kind: "heart",
            x: x + (Math.random() - 0.5) * 12,
            y,
            vx: (Math.random() - 0.5) * 8,
            vy: -(12 + Math.random() * 10),
            born: now + i * 110,
            life: 1500,
            size: 1,
        });
    }
}

export function spawnZ(fx: Fx, x: number, y: number, now: number) {
    fx.particles.push({
        kind: "zzz",
        x,
        y,
        vx: 7,
        vy: -9,
        born: now,
        life: 2000,
        size: Math.random() < 0.5 ? 1 : 2,
    });
}

export function spawnSparks(fx: Fx, x: number, y: number, now: number, count = 14) {
    const colors = ["#ffe08a", "#ffffff", "#f5c26b"];
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const speed = 24 + Math.random() * 18;
        fx.particles.push({
            kind: "spark",
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            born: now,
            life: 900,
            size: 1,
            color: colors[i % colors.length],
        });
    }
}

export function addPopup(
    fx: Fx,
    text: string,
    x: number,
    y: number,
    now: number,
    color = "#ffffff",
    big = false,
    life?: number, // optional override in ms (reaction messages use 3000)
) {
    fx.popups.push({ text, x, y, born: now, life: life ?? (big ? 2200 : 1700), color, big });
}

const HEART = ["0110110", "1111111", "1111111", "0111110", "0011100", "0001000"];
const Z = ["11111", "00010", "00100", "01000", "11111"];

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
    const px = Math.round(x);
    const py = Math.round(y);
    ctx.fillStyle = color;
    for (let r = 0; r < HEART.length; r++) {
        for (let c = 0; c < HEART[r].length; c++) {
            if (HEART[r][c] === "1") ctx.fillRect(px + c, py + r, 1, 1);
        }
    }
    ctx.fillStyle = "#ffd0e0";
    ctx.fillRect(px + 1, py + 1, 1, 1);
}

function drawZ(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
    const px = Math.round(x);
    const py = Math.round(y);
    ctx.fillStyle = "#5b7fa6";
    for (let r = 0; r < Z.length; r++) {
        for (let c = 0; c < Z[r].length; c++) {
            if (Z[r][c] === "1") ctx.fillRect(px + c * size, py + r * size, size, size);
        }
    }
}

/** Updates and draws all particles and popups. Call once per frame, after the scene. */
export function drawFx(ctx: CanvasRenderingContext2D, fx: Fx, now: number) {
    fx.particles = fx.particles.filter((p) => now - p.born < p.life);
    fx.popups = fx.popups.filter((p) => now - p.born < p.life);

    for (const p of fx.particles) {
        const age = now - p.born;
        if (age < 0) continue; // not spawned yet
        const s = age / 1000;
        const x = p.x + p.vx * s;
        const y = p.y + p.vy * s;
        const fadeStart = p.life * 0.65;
        ctx.globalAlpha = age > fadeStart ? Math.max(0, 1 - (age - fadeStart) / (p.life - fadeStart)) : 1;

        if (p.kind === "heart") drawHeart(ctx, x, y, p.color ?? "#f06292");
        else if (p.kind === "zzz") drawZ(ctx, x + Math.sin(age / 250) * 2, y, p.size);
        else {
            ctx.fillStyle = p.color ?? "#ffe08a";
            ctx.fillRect(Math.round(x), Math.round(y) - 1, 1, 3);
            ctx.fillRect(Math.round(x) - 1, Math.round(y), 3, 1);
        }
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    for (const p of fx.popups) {
        const age = now - p.born;
        if (age < 0) continue;
        const t = age / p.life;
        ctx.globalAlpha = t > 0.7 ? Math.max(0, 1 - (t - 0.7) / 0.3) : 1;
        ctx.font = p.big ? "bold 12px sans-serif" : "bold 9px sans-serif";
        const y = p.y - 14 * t;
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(60, 40, 20, 0.85)";
        ctx.strokeText(p.text, p.x, y);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, p.x, y);
    }

    ctx.globalAlpha = 1;
}

/** The avatar lying in bed: head on the pillow, body under the blanket. Drawn right after the bed. */
export function drawSleeper(ctx: CanvasRenderingContext2D, look: AvatarLook, frame: number) {
    const SKIN = "#ffd9b3";
    const HAIR = "#4a3728";
    const shirt = getItem("shirt", look.shirtId)?.color ?? "#6366f1";

    // hair on the pillow (longer for the female avatar)
    ctx.fillStyle = HAIR;
    if (look.gender === "female") ctx.fillRect(66, 91, 10, 7);
    else if (look.gender === "unisex") ctx.fillRect(67, 91, 9, 5);

    // head with closed eyes
    ctx.fillStyle = SKIN;
    ctx.fillRect(68, 91, 9, 8);
    ctx.fillStyle = HAIR;
    ctx.fillRect(68, 91, 9, 3);
    ctx.fillStyle = "#2b2b2b";
    ctx.fillRect(70, 95, 2, 1);
    ctx.fillRect(74, 95, 2, 1);

    // shoulders
    ctx.fillStyle = shirt;
    ctx.fillRect(77, 94, 5, 7);

    // blanket on top, rising and falling with the breathing
    const breathe = Math.floor(frame / 30) % 2;
    ctx.fillStyle = "#8fb59a";
    ctx.fillRect(80, 92 - breathe, 42, 11 + breathe);
    ctx.fillStyle = shade("#8fb59a", -0.12);
    ctx.fillRect(80, 92 - breathe, 42, 2);
}