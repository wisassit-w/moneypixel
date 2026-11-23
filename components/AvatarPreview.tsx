"use client";

import { useEffect, useRef } from "react";
import { drawAvatar, type AvatarLook } from "@/lib/avatar";

export default function AvatarPreview({ look, className = "h-24" }: { look: AvatarLook; className?: string }) {
    const ref = useRef<HTMLCanvasElement>(null);
    const { gender, hatId, shirtId, pantsId, shoesId } = look;

    useEffect(() => {
        const ctx = ref.current?.getContext("2d");
        if (!ctx) return;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, 26, 52);
        drawAvatar(ctx, 5, 8, { gender, hatId, shirtId, pantsId, shoesId });
    }, [gender, hatId, shirtId, pantsId, shoesId]);

    return (
        <canvas
            ref={ref}
            width={26}
            height={52}
            className={`w-auto ${className}`}
            style={{ imageRendering: "pixelated" }}
        />
    );
}