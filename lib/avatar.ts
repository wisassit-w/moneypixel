import { getItem, type Gender, type Slot } from "@/lib/catalog";

export type AvatarLook = {
    gender: Gender;
    hatId: string;
    shirtId: string;
    pantsId: string;
    shoesId: string;
};

export type AvatarAnim = { bob?: number; frame?: number; moving?: boolean };

const SKIN = "#ffd9b3";
const HAIR = "#4a3728";

export function shade(hex: string, amt: number): string {
    const n = parseInt(hex.slice(1), 16);
    const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + 255 * amt)));
    return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

export function withItem(look: AvatarLook, slot: Slot, id: string): AvatarLook {
    switch (slot) {
        case "hat":
            return { ...look, hatId: id };
        case "shirt":
            return { ...look, shirtId: id };
        case "pants":
            return { ...look, pantsId: id };
        case "shoes":
            return { ...look, shoesId: id };
    }
}

export function equippedOf(look: AvatarLook, slot: Slot): string {
    switch (slot) {
        case "hat":
            return look.hatId;
        case "shirt":
            return look.shirtId;
        case "pants":
            return look.pantsId;
        case "shoes":
            return look.shoesId;
    }
}

/**
 * Draws the layered avatar. (ax, ay) = top-left of the head box. Total height ~38px.
 * Layers: base body -> shoes -> pants -> shirt -> hair/face -> hat.
 */
export function drawAvatar(
    ctx: CanvasRenderingContext2D,
    ax: number,
    ay: number,
    look: AvatarLook,
    anim: AvatarAnim = {},
) {
    const { bob = 0, frame = 0, moving = false } = anim;
    const phase = moving ? Math.floor(frame / 5) % 2 : 0;
    const y = ay + bob;

    const female = look.gender === "female";
    const tx = female ? ax + 1 : ax; // torso x
    const tw = female ? 14 : 16; // torso width

    const legX = [ax + 2, ax + 9];
    const legH = [moving && phase === 0 ? 6 : 8, moving && phase === 1 ? 6 : 8]; // lifted leg when running
    const armDy = moving ? (phase === 0 ? [-1, 1] : [1, -1]) : [0, 0];
    const armX = [tx - 2, tx + tw - 1];

    // ---- 1. base body ----
    ctx.fillStyle = SKIN;
    ctx.fillRect(ax + 6, y + 11, 4, 2); // neck
    for (let i = 0; i < 2; i++) {
        ctx.fillRect(armX[i], y + 13 + armDy[i], 3, 11); // arms
        ctx.fillRect(legX[i], y + 30, 5, legH[i]); // legs
    }
    ctx.fillRect(ax + 2, y, 12, 12); // face

    // ---- 2. shoes ----
    const shoes = getItem("shoes", look.shoesId);
    if (shoes) {
        for (let i = 0; i < 2; i++) {
            const bottom = y + 30 + legH[i];
            const sx = legX[i] - 1;
            ctx.fillStyle = shoes.color;
            ctx.fillRect(sx, bottom - 3, 7, 2);
            ctx.fillStyle = shade(shoes.color, -0.3);
            ctx.fillRect(sx, bottom - 1, 7, 1);
            if (shoes.style === "runner" && shoes.accent) {
                ctx.fillStyle = shoes.accent;
                ctx.fillRect(sx + 1, bottom - 3, 4, 1);
            }
            if (shoes.style === "canvas") {
                ctx.fillStyle = "#f5f5f4";
                ctx.fillRect(sx + 5, bottom - 3, 2, 2);
            }
            if (shoes.style === "loafer") {
                ctx.fillStyle = "#d4a24c";
                ctx.fillRect(sx + 3, bottom - 3, 1, 1);
            }
        }
    }

    // ---- 3. pants ----
    const pants = getItem("pants", look.pantsId);
    if (pants) {
        ctx.fillStyle = pants.color;
        if (pants.style === "skirt") {
            ctx.fillRect(tx - 1, y + 26, tw + 2, 3);
            ctx.fillRect(tx - 2, y + 29, tw + 4, 4);
            ctx.fillStyle = shade(pants.color, -0.18);
            for (let x = tx - 1; x < tx + tw + 1; x += 3) ctx.fillRect(x, y + 27, 1, 5);
        } else {
            ctx.fillRect(tx, y + 26, tw, 4);
            const len = pants.style === "shorts" ? 3 : 6;
            for (let i = 0; i < 2; i++) ctx.fillRect(legX[i], y + 30, 5, Math.min(len, legH[i] - 2));
            if (pants.style === "pants") {
                ctx.fillStyle = shade(pants.color, -0.2);
                ctx.fillRect(tx, y + 26, tw, 1); // waistband
            }
        }
    }

    // ---- 4. shirt ----
    const shirt = getItem("shirt", look.shirtId);
    if (shirt) {
        const c = shirt.color;
        const dark = shade(c, -0.15);
        const sleeves = (len: number, wide = 0) => {
            ctx.fillStyle = c;
            ctx.fillRect(armX[0] - wide, y + 13 + armDy[0], 3 + wide, len);
            ctx.fillRect(armX[1], y + 13 + armDy[1], 3 + wide, len);
        };

        switch (shirt.style) {
            case "hoodie":
                ctx.fillStyle = dark;
                ctx.fillRect(ax + 4, y + 11, 8, 3); // hood
                ctx.fillStyle = c;
                ctx.fillRect(tx, y + 13, tw, 13);
                sleeves(9);
                ctx.fillStyle = dark;
                ctx.fillRect(tx + 3, y + 20, tw - 6, 4); // pocket
                ctx.fillStyle = shade(c, 0.25);
                ctx.fillRect(ax + 6, y + 14, 1, 4); // strings
                ctx.fillRect(ax + 9, y + 14, 1, 4);
                break;
            case "sweater":
                ctx.fillStyle = c;
                ctx.fillRect(tx - 1, y + 12, tw + 2, 16);
                sleeves(10, 1);
                ctx.fillStyle = dark;
                ctx.fillRect(tx - 1, y + 27, tw + 2, 1); // ribbed hem
                ctx.fillRect(ax + 5, y + 12, 6, 1); // collar
                break;
            case "jersey":
                ctx.fillStyle = c;
                ctx.fillRect(tx, y + 12, tw, 14);
                sleeves(4);
                ctx.fillStyle = shirt.accent ?? dark;
                ctx.fillRect(tx + Math.floor(tw / 2) - 2, y + 16, 4, 6); // number block
                ctx.fillRect(armX[0], y + 16 + armDy[0], 3, 1); // cuffs
                ctx.fillRect(armX[1], y + 16 + armDy[1], 3, 1);
                ctx.fillRect(ax + 5, y + 12, 6, 1); // collar
                break;
            default: // tee
                ctx.fillStyle = c;
                ctx.fillRect(tx, y + 12, tw, 14);
                sleeves(4);
                ctx.fillStyle = SKIN;
                ctx.fillRect(ax + 6, y + 12, 4, 1); // neckline
        }
    }

    // ---- 5. hair + face (shape depends on gender) ----
    ctx.fillStyle = HAIR;
    if (look.gender === "female") {
        ctx.fillRect(ax + 1, y - 1, 14, 5);
        ctx.fillRect(ax + 1, y + 4, 2, 13);
        ctx.fillRect(ax + 13, y + 4, 2, 13);
    } else if (look.gender === "unisex") {
        ctx.fillRect(ax + 2, y - 1, 12, 5);
        ctx.fillRect(ax + 2, y + 4, 2, 8);
        ctx.fillRect(ax + 12, y + 4, 2, 8);
    } else {
        ctx.fillRect(ax + 2, y, 12, 4);
        ctx.fillRect(ax + 2, y + 4, 2, 2);
        ctx.fillRect(ax + 12, y + 4, 2, 2);
    }
    ctx.fillStyle = "#2b2b2b";
    ctx.fillRect(ax + 5, y + 7, 1, 2);
    ctx.fillRect(ax + 10, y + 7, 1, 2);
    ctx.fillStyle = "#d89a8c";
    ctx.fillRect(ax + 7, y + 10, 2, 1);
    if (female) {
        ctx.fillStyle = "#f4b6b0";
        ctx.fillRect(ax + 4, y + 9, 2, 1);
        ctx.fillRect(ax + 10, y + 9, 2, 1);
    }

    // ---- 6. hat / accessory ----
    const hat = getItem("hat", look.hatId);
    if (hat && hat.style !== "none") {
        const c = hat.color;
        switch (hat.style) {
            case "cap":
                ctx.fillStyle = c;
                ctx.fillRect(ax + 2, y - 2, 12, 5);
                ctx.fillStyle = shade(c, -0.2);
                ctx.fillRect(ax + 2, y + 2, 12, 1);
                ctx.fillStyle = shade(c, -0.35);
                ctx.fillRect(ax + 3, y + 3, 10, 1); // brim
                ctx.fillStyle = shade(c, 0.2);
                ctx.fillRect(ax + 7, y - 3, 2, 1); // button
                break;
            case "bucket":
                ctx.fillStyle = c;
                ctx.fillRect(ax + 3, y - 3, 10, 5);
                ctx.fillStyle = shade(c, -0.1);
                ctx.fillRect(ax, y + 1, 16, 2); // brim
                ctx.fillStyle = shade(c, -0.25);
                ctx.fillRect(ax + 3, y, 10, 1); // band
                break;
            case "ears":
                ctx.fillStyle = c;
                ctx.fillRect(ax + 2, y - 4, 3, 4);
                ctx.fillRect(ax + 11, y - 4, 3, 4);
                ctx.fillStyle = hat.accent ?? "#f4a6b8";
                ctx.fillRect(ax + 3, y - 3, 1, 2);
                ctx.fillRect(ax + 12, y - 3, 1, 2);
                break;
            case "headphones":
                ctx.fillStyle = c;
                ctx.fillRect(ax + 1, y - 2, 14, 1); // band
                ctx.fillRect(ax + 1, y - 1, 1, 6);
                ctx.fillRect(ax + 14, y - 1, 1, 6);
                ctx.fillRect(ax - 1, y + 4, 3, 6); // cups
                ctx.fillRect(ax + 14, y + 4, 3, 6);
                ctx.fillStyle = hat.accent ?? "#8fb59a";
                ctx.fillRect(ax, y + 5, 1, 4);
                ctx.fillRect(ax + 15, y + 5, 1, 4);
                break;
        }
    }
}