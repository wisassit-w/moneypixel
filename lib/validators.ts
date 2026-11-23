// Pure input checks shared by the register and login actions and by the Credentials provider.

export const MAX_EMAIL = 254;
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD_BYTES = 72; // bcrypt silently ignores everything after 72 bytes

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Trim + lowercase, so "Boom@Gmail.com " and "boom@gmail.com" are the same account. */
export const normalizeEmail = (v: unknown): string =>
    typeof v === "string" ? v.trim().toLowerCase().slice(0, MAX_EMAIL + 1) : "";

export const isValidEmail = (e: string) => e.length > 0 && e.length <= MAX_EMAIL && EMAIL_RE.test(e);

/** Display name: control characters removed, whitespace collapsed, 1-40 characters. */
export function cleanName(v: unknown): string | null {
    if (typeof v !== "string") return null;
    // eslint-disable-next-line no-control-regex
    const s = v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
    return s.length >= 1 && s.length <= 40 ? s : null;
}

/** Returns a translation key when the password is unacceptable, otherwise null. */
export function passwordProblem(p: unknown, email?: string): string | null {
    if (typeof p !== "string" || p.length < MIN_PASSWORD) return "err.weakPassword";
    if (new TextEncoder().encode(p).length > MAX_PASSWORD_BYTES) return "err.weakPassword";
    if (email && p.toLowerCase() === email) return "err.weakPassword";
    return null;
}