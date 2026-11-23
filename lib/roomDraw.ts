import { drawAvatar, shade, type AvatarLook } from "@/lib/avatar";
import type { PetType } from "@/lib/catalog";
import { drawSleeper } from "@/lib/roomFx";

export const W = 320;
export const H = 180;
export const FLOOR_Y = 110;

export const HOME = { x: 152, y: 106 }; // avatar idle position (head top-left)
export const TREADMILL_POS = { x: 254, y: 114 }; // avatar on the treadmill belt
export const BED_FRONT = { x: 96, y: 108 }; // where the avatar stands before lying down

export type Hotspot = "wardrobe" | "monitor" | "tv" | "treadmill" | "bed" | "pet" | "piggy";
export const HOTSPOTS: Record<Hotspot, { x: number; y: number; w: number; h: number }> = {
    wardrobe: { x: 8, y: 35, w: 48, h: 78 },
    monitor: { x: 238, y: 54, w: 34, h: 28 },
    tv: { x: 162, y: 66, w: 44, h: 44 },
    treadmill: { x: 226, y: 118, w: 74, h: 50 },
    bed: { x: 58, y: 82, w: 68, h: 30 },
    pet: { x: 183, y: 133, w: 24, h: 27 },
    piggy: { x: 126, y: 70, w: 36, h: 41 },
};

export type Furniture = {
    bed: boolean;
    sofa: boolean;
    tv: boolean;
    treadmill: boolean;
    desk: boolean;
    wardrobe: boolean;
};

export type Scene = {
    furniture: Furniture;
    pet: PetType;
    petOffsetY: number; // bounce when petted
    look: AvatarLook;
    avatar: { x: number; y: number; bob: number; moving: boolean };
    sleeping: boolean; // avatar is lying in bed (standing avatar is hidden)
    savingsPct: number; // 0..1 = savingsCurrent / savingsGoalTarget; the piggy bank grows with it
    tvOn: boolean;
    beltRunning: boolean;
    hover: Hotspot | null;
    frame: number;
    overlay?: (ctx: CanvasRenderingContext2D) => void; // particles / popups, drawn last
};

function drawShell(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "#ece6da"; // wall
    ctx.fillRect(0, 0, W, FLOOR_Y);
    ctx.fillStyle = "#d3c9b6"; // baseboard
    ctx.fillRect(0, FLOOR_Y - 4, W, 4);
    ctx.fillStyle = "#d9b99b"; // floor
    ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
    ctx.fillStyle = "#cfae8f";
    for (let x = 0; x < W; x += 32) ctx.fillRect(x, FLOOR_Y, 1, H - FLOOR_Y);

    // window
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(92, 20, 60, 50);
    ctx.fillStyle = "#a8d8ff";
    ctx.fillRect(95, 23, 54, 44);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(121, 23, 2, 44);
    ctx.fillRect(95, 44, 54, 2);
}

function drawWardrobe(ctx: CanvasRenderingContext2D) {
    const x = 10, y = 38, w = 44, h = 72;
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(x + 2, y + h, w, 3);
    ctx.fillStyle = "#5c3a22";
    ctx.fillRect(x + 3, y + h, 4, 3);
    ctx.fillRect(x + w - 7, y + h, 4, 3);
    ctx.fillStyle = "#7a4e2f";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#b07a52";
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.fillStyle = "#8a5a3a";
    ctx.fillRect(x - 2, y - 3, w + 4, 5);
    ctx.fillStyle = "#c28d62";
    ctx.fillRect(x + 4, y + 6, w / 2 - 5, h - 14);
    ctx.fillRect(x + w / 2 + 1, y + 6, w / 2 - 5, h - 14);
    ctx.fillStyle = "#7a4e2f";
    ctx.fillRect(x + w / 2 - 1, y + 4, 2, h - 10);
    ctx.fillStyle = "#f5c26b";
    ctx.fillRect(x + w / 2 - 5, y + h / 2 - 4, 2, 8);
    ctx.fillRect(x + w / 2 + 3, y + h / 2 - 4, 2, 8);
}

function drawBed(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "#7a4e2f"; // headboard
    ctx.fillRect(60, 84, 4, 26);
    ctx.fillStyle = "#8a5a3a"; // frame
    ctx.fillRect(62, 102, 62, 8);
    ctx.fillStyle = "#efe8da"; // mattress
    ctx.fillRect(64, 94, 58, 9);
    ctx.fillStyle = "#8fb59a"; // blanket
    ctx.fillRect(80, 93, 42, 10);
    ctx.fillStyle = shade("#8fb59a", -0.12);
    ctx.fillRect(80, 93, 42, 2);
    ctx.fillStyle = "#ffffff"; // pillow
    ctx.fillRect(66, 90, 14, 6);
    ctx.fillStyle = "#7a4e2f"; // footboard
    ctx.fillRect(122, 96, 3, 14);
}

/**
 * MONEYPIXEL: the Piggy Bank. It stands on a small side table between the bed and the TV and
 * grows from 0.75x to 1.5x as the savings goal fills up. The thin bar on the table shows the percentage.
 */
function drawPiggy(ctx: CanvasRenderingContext2D, pct: number, frame: number) {
    const p = Math.max(0, Math.min(1, pct));

    // side table
    ctx.fillStyle = "#8a5a3a";
    ctx.fillRect(126, 96, 34, 3);
    ctx.fillStyle = "#7a4e2f";
    ctx.fillRect(128, 99, 3, 11);
    ctx.fillRect(155, 99, 3, 11);

    // progress bar on the table front
    ctx.fillStyle = "#6e4528";
    ctx.fillRect(132, 100, 22, 4);
    ctx.fillStyle = p >= 1 ? "#ffd36e" : "#8fe3a6";
    ctx.fillRect(133, 101, Math.round(20 * p), 2);

    // piggy: base design is 20x16 px; the scale is rounded to quarter steps so pixels stay crisp
    const scale = Math.round((0.75 + 0.75 * p) * 4) / 4;
    const pink = "#f4a6b8";
    const dark = shade(pink, -0.14);

    ctx.save();
    ctx.translate(143 - 10 * scale, 96 - 16 * scale); // sits on the table, centered
    ctx.scale(scale, scale);

    ctx.fillStyle = dark; // far legs
    ctx.fillRect(4, 13, 3, 3);
    ctx.fillRect(13, 13, 3, 3);
    ctx.fillStyle = pink; // body
    ctx.fillRect(2, 3, 16, 10);
    ctx.fillRect(3, 2, 14, 1);
    ctx.fillRect(3, 13, 14, 1);
    ctx.fillStyle = dark; // belly shade
    ctx.fillRect(3, 11, 14, 2);
    ctx.fillStyle = dark; // ears
    ctx.fillRect(4, 0, 3, 3);
    ctx.fillRect(12, 0, 3, 3);
    ctx.fillStyle = "#ffd0e0";
    ctx.fillRect(5, 1, 1, 1);
    ctx.fillRect(13, 1, 1, 1);
    ctx.fillStyle = "#e98aa0"; // snout
    ctx.fillRect(17, 6, 3, 4);
    ctx.fillStyle = "#6b3b4a";
    ctx.fillRect(18, 7, 1, 1);
    ctx.fillRect(18, 9, 1, 1);
    ctx.fillStyle = "#2b2b2b"; // eye
    ctx.fillRect(13, 5, 1, 2);
    ctx.fillStyle = "#6b3b4a"; // coin slot
    ctx.fillRect(8, 2, 4, 1);
    ctx.fillStyle = pink; // curly tail
    ctx.fillRect(0, 5, 2, 1);
    ctx.fillRect(0, 4, 1, 1);

    // goal reached: golden sparkle
    if (p >= 1 && Math.floor(frame / 20) % 2 === 0) {
        ctx.fillStyle = "#ffe08a";
        ctx.fillRect(16, -2, 2, 2);
        ctx.fillRect(1, 1, 1, 1);
    }
    ctx.restore();
}

function drawTv(ctx: CanvasRenderingContext2D, on: boolean, frame: number) {
    if (on) {
        ctx.fillStyle = "rgba(255, 214, 110, 0.10)"; // glow
        ctx.fillRect(150, 58, 68, 66);
    }
    ctx.fillStyle = "#8a5a3a"; // cabinet
    ctx.fillRect(162, 98, 44, 12);
    ctx.fillStyle = "#6e4528";
    ctx.fillRect(162, 104, 44, 1);
    ctx.fillRect(165, 110, 3, 2);
    ctx.fillRect(200, 110, 3, 2);
    ctx.fillStyle = "#1f2128"; // set
    ctx.fillRect(166, 70, 36, 26);

    if (on) {
        const colors = ["#6ec6ff", "#ffd36e", "#ff8fa3", "#8fe3a6"];
        const shift = Math.floor(frame / 10);
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = colors[(i + shift) % colors.length];
            ctx.fillRect(168, 72 + i * 5, 32, 5);
        }
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.fillRect(168 + (Math.floor(frame / 2) % 30), 72, 2, 20);
    } else {
        ctx.fillStyle = "#14161c";
        ctx.fillRect(168, 72, 32, 20);
        ctx.fillStyle = "#232733";
        ctx.fillRect(170, 74, 8, 1);
        ctx.fillRect(170, 76, 5, 1);
    }
    ctx.fillStyle = on ? "#8fe3a6" : "#c0392b"; // power LED
    ctx.fillRect(198, 94, 2, 1);
}

function drawDesk(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "#8b6b4a";
    ctx.fillRect(220, 80, 70, 8);
    ctx.fillRect(224, 88, 4, 30);
    ctx.fillRect(282, 88, 4, 30);
}

function drawMonitor(ctx: CanvasRenderingContext2D, hover: boolean) {
    ctx.fillStyle = "#2d2d3a";
    ctx.fillRect(253, 78, 4, 2);
    ctx.fillRect(240, 56, 30, 22);
    ctx.fillStyle = hover ? "#b8d8c0" : "#8fb59a";
    ctx.fillRect(242, 58, 26, 16);
    ctx.fillStyle = "#e8f2ea";
    ctx.fillRect(245, 61, 14, 1);
    ctx.fillRect(245, 64, 18, 1);
    ctx.fillRect(245, 67, 10, 1);
    ctx.fillStyle = hover ? "#f5c26b" : "#d4e6d9";
    ctx.fillRect(262, 60, 2, 2);
}

function drawRug(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "#e8c9a0";
    ctx.fillRect(110, 140, 100, 28);
}

function drawSofa(ctx: CanvasRenderingContext2D) {
    const c = "#c08a6a";
    const d = shade(c, -0.14);
    ctx.fillStyle = d;
    ctx.fillRect(16, 124, 72, 16);
    ctx.fillStyle = c;
    ctx.fillRect(12, 130, 9, 24);
    ctx.fillRect(83, 130, 9, 24);
    ctx.fillRect(21, 138, 62, 14);
    ctx.fillStyle = shade(c, 0.1);
    ctx.fillRect(23, 134, 28, 8);
    ctx.fillRect(53, 134, 28, 8);
    ctx.fillStyle = d;
    ctx.fillRect(21, 148, 62, 4);
    ctx.fillStyle = "#5c3a22";
    ctx.fillRect(14, 154, 3, 3);
    ctx.fillRect(87, 154, 3, 3);
    ctx.fillStyle = "#f5c26b";
    ctx.fillRect(25, 130, 8, 8);
}

function drawTreadmill(ctx: CanvasRenderingContext2D, frame: number, running: boolean) {
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(228, 164, 70, 3);
    ctx.fillStyle = "#4a4f5c";
    ctx.fillRect(284, 128, 4, 26);
    ctx.fillStyle = "#2d2d3a";
    ctx.fillRect(274, 120, 22, 9);
    ctx.fillStyle = running ? "#8fe3a6" : "#8fb59a";
    ctx.fillRect(277, 122, 16, 4);
    ctx.fillStyle = "#6b7280";
    ctx.fillRect(228, 150, 68, 2);
    ctx.fillStyle = "#3a3d49";
    ctx.fillRect(230, 152, 64, 3);
    ctx.fillStyle = "#2f313b";
    ctx.fillRect(230, 155, 64, 8);
    ctx.fillStyle = "#555a69";
    const off = running ? frame * 2 : 0;
    for (let i = 0; i < 8; i++) ctx.fillRect(230 + ((i * 8 + off) % 64), 152, 2, 3);
}

function drawPet(ctx: CanvasRenderingContext2D, type: PetType, frame: number, dy: number) {
    if (type === "none") return;
    const x = 186;
    const y = 140 + dy;

    ctx.fillStyle = "rgba(0,0,0,0.12)"; // shadow stays on the ground while the pet bounces
    ctx.fillRect(x - 1, 156, type === "cat" ? 16 : 18, 2);

    if (type === "cat") {
        const fur = "#e8a15c";
        const wag = Math.floor(frame / 12) % 2;
        ctx.fillStyle = fur;
        if (wag) {
            ctx.fillRect(x + 12, y + 13, 4, 2);
            ctx.fillRect(x + 15, y + 9, 2, 5);
        } else {
            ctx.fillRect(x + 12, y + 7, 2, 8);
        }
        ctx.fillRect(x, y + 8, 12, 8);
        ctx.fillRect(x + 1, y, 10, 9);
        ctx.fillRect(x + 1, y - 3, 3, 3);
        ctx.fillRect(x + 8, y - 3, 3, 3);
        ctx.fillStyle = "#f4a6b8";
        ctx.fillRect(x + 2, y - 2, 1, 2);
        ctx.fillRect(x + 9, y - 2, 1, 2);
        ctx.fillStyle = shade(fur, -0.18);
        ctx.fillRect(x + 5, y, 2, 3);
        ctx.fillRect(x, y + 10, 2, 2);
        ctx.fillStyle = "#2b2b2b";
        ctx.fillRect(x + 3, y + 3, 1, 2);
        ctx.fillRect(x + 8, y + 3, 1, 2);
        ctx.fillStyle = "#f4a6b8";
        ctx.fillRect(x + 5, y + 6, 2, 1);
        ctx.fillStyle = "#f6dcc0";
        ctx.fillRect(x + 2, y + 14, 3, 2);
        ctx.fillRect(x + 7, y + 14, 3, 2);
    } else {
        const fur = "#c9a27a";
        const wag = Math.floor(frame / 6) % 2;
        ctx.fillStyle = fur;
        ctx.fillRect(x + 14, y + (wag ? 6 : 9), 3, 3);
        ctx.fillRect(x, y + 8, 14, 8);
        ctx.fillRect(x + 2, y, 10, 9);
        ctx.fillStyle = "#7a5230";
        ctx.fillRect(x, y + 1, 3, 7);
        ctx.fillRect(x + 11, y + 1, 3, 7);
        ctx.fillStyle = "#ead7bd";
        ctx.fillRect(x + 4, y + 5, 6, 4);
        ctx.fillStyle = "#2b2b2b";
        ctx.fillRect(x + 6, y + 5, 2, 2);
        ctx.fillRect(x + 4, y + 3, 1, 2);
        ctx.fillRect(x + 9, y + 3, 1, 2);
        if (wag) {
            ctx.fillStyle = "#f4a6b8";
            ctx.fillRect(x + 6, y + 9, 2, 2);
        }
        ctx.fillStyle = "#ead7bd";
        ctx.fillRect(x + 2, y + 14, 3, 2);
        ctx.fillRect(x + 9, y + 14, 3, 2);
    }
}

export function drawScene(ctx: CanvasRenderingContext2D, s: Scene) {
    const f = s.furniture;
    ctx.clearRect(0, 0, W, H);

    drawShell(ctx);
    if (f.wardrobe) drawWardrobe(ctx);
    if (f.bed) {
        drawBed(ctx);
        if (s.sleeping) drawSleeper(ctx, s.look, s.frame);
    }
    drawPiggy(ctx, s.savingsPct, s.frame);
    if (f.tv) drawTv(ctx, s.tvOn, s.frame);
    if (f.desk) {
        drawDesk(ctx);
        drawMonitor(ctx, s.hover === "monitor");
    }
    drawRug(ctx);
    if (f.sofa) drawSofa(ctx);
    if (f.treadmill) drawTreadmill(ctx, s.frame, s.beltRunning);
    drawPet(ctx, s.pet, s.frame, s.petOffsetY);

    if (!s.sleeping) {
        ctx.fillStyle = "rgba(0,0,0,0.15)";
        ctx.fillRect(s.avatar.x - 2, s.avatar.y + 37, 20, 3);
        drawAvatar(ctx, s.avatar.x, s.avatar.y, s.look, {
            bob: s.avatar.bob,
            frame: s.frame,
            moving: s.avatar.moving,
        });
    }

    if (s.hover) {
        const r = HOTSPOTS[s.hover];
        ctx.strokeStyle = "#f5c26b";
        ctx.lineWidth = 1;
        ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w, r.h);
    }

    s.overlay?.(ctx);
}