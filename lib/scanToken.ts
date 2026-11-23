import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const TTL_MS = 15 * 60 * 1000; // a scan result must be saved within 15 minutes

const secret = () => process.env.SCAN_TOKEN_SECRET || process.env.AUTH_SECRET || process.env.GEMINI_API_KEY || "";
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

/** Issued by /api/vision after a successful scan: "expires.nonce.userId.signature" */
export function createScanToken(userId: string): string {
    const payload = `${Date.now() + TTL_MS}.${randomBytes(8).toString("hex")}.${userId}`;
    return `${payload}.${sign(payload)}`;
}

/** Returns the nonce if the token is genuine, unexpired and belongs to this user, otherwise null. */
export function verifyScanToken(token: string, userId: string): string | null {
    if (!secret()) return null;
    const parts = token.split(".");
    if (parts.length !== 4) return null;

    const [exp, nonce, uid, sig] = parts;
    if (uid !== userId) return null; // ตรวจสอบว่าโทเค็นนี้เป็นของ User คนนี้จริงๆ หรือไม่

    const expected = sign(`${exp}.${nonce}.${uid}`);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    if (!(Number(exp) > Date.now())) return null;
    return nonce;
}