import bcrypt from "bcryptjs";

// Cost factor 12 (requirement: 10 or more). Each +1 doubles the work, ~250 ms per hash at 12.
export const BCRYPT_COST = 12;

export const hashPassword = (plain: string) => bcrypt.hash(plain, BCRYPT_COST);

let dummyHash: Promise<string> | null = null;

/**
 * Checks a password without revealing whether the account exists.
 * Unknown emails (and Google-only accounts without a password) are compared against a throwaway hash,
 * so a wrong email takes as long as a wrong password and the two can't be told apart by timing.
 */
export async function verifyPassword(plain: string, hash: string | null | undefined): Promise<boolean> {
    const target = hash ?? (await (dummyHash ??= bcrypt.hash("moneypixel-no-such-user", BCRYPT_COST)));
    const matches = await bcrypt.compare(plain, target);
    return matches && !!hash;
}