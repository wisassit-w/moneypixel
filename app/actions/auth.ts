"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { STARTER_BILLS, STARTING_COINS } from "@/lib/starterBills";
import { cleanName, isValidEmail, normalizeEmail, passwordProblem } from "@/lib/validators";

// Errors are returned as translation keys; the login form translates them.
export type AuthState = { error: string } | null;

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

export async function signInWithGoogle() {
    await signIn("google", { redirectTo: "/" });
}

export async function signOutAction() {
    await signOut({ redirectTo: "/login" });
}

/** Email + password sign-in. Used with useActionState on the login form. */
export async function loginUser(_prev: AuthState, formData: FormData): Promise<AuthState> {
    const email = normalizeEmail(formData.get("email"));
    const password = formData.get("password");
    if (!isValidEmail(email) || typeof password !== "string" || !password) return { error: "err.invalidCredentials" };

    // 8 tries per email per 15 minutes, with a friendly message
    if (!rateLimit(`login:${email}`, 8, FIFTEEN_MINUTES).ok) return { error: "err.tooManyAttempts" };

    try {
        await signIn("credentials", { email, password, redirectTo: "/" });
    } catch (error) {
        if (error instanceof AuthError) {
            // the same message for "no such email" and "wrong password": accounts can't be probed
            return { error: error.type === "CredentialsSignin" ? "err.invalidCredentials" : "err.authFailed" };
        }
        throw error; // the redirect after a successful sign-in is thrown by Next and must pass through
    }
    return null;
}

/**
 * Create an email/password account.
 * Sanitizes every input, hashes the password with bcrypt, and starts the student with
 * STARTING_COINS (100) coins, 0 EXP (Level 1) and the default dorm bills, in one atomic insert.
 */
export async function registerUser(_prev: AuthState, formData: FormData): Promise<AuthState> {
    const name = cleanName(formData.get("name"));
    const email = normalizeEmail(formData.get("email"));
    const password = formData.get("password");
    const confirm = formData.get("confirm");

    if (!name) return { error: "err.invalidName" };
    if (!isValidEmail(email)) return { error: "err.invalidEmail" };
    const weak = passwordProblem(password, email);
    if (weak) return { error: weak };
    if (password !== confirm) return { error: "err.passwordMismatch" };

    const ip = clientIp(await headers());
    if (!rateLimit(`register:ip:${ip}`, 5, ONE_HOUR).ok || !rateLimit(`register:email:${email}`, 3, ONE_HOUR).ok) {
        return { error: "err.tooManyAttempts" };
    }

    try {
        await prisma.user.create({
            data: {
                name,
                email,
                password: await hashPassword(password as string),
                totalCoins: STARTING_COINS,
                bills: { create: STARTER_BILLS.map((b) => ({ ...b })) },
            },
        });
    } catch (err) {
        // P2002 = unique constraint: this email already has an account (email/password or Google)
        if ((err as { code?: string }).code === "P2002") return { error: "err.emailTaken" };
        console.error("[register] could not create the user:", err);
        return { error: "err.authFailed" };
    }

    // sign the new student straight in
    try {
        await signIn("credentials", { email, password, redirectTo: "/" });
    } catch (error) {
        if (error instanceof AuthError) return { error: "err.authFailed" };
        throw error;
    }
    return null;
}