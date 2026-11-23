import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Shared by auth.ts (full config with the database) and proxy.ts (cookie-only check).
// Google reads AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET from .env automatically.
export const authConfig = {
    providers: [Google],
    pages: { signIn: "/login" },
    callbacks: {
        // Runs in proxy.ts for every protected page.
        // Returning false sends the visitor to /login; a signed-in visitor on /login goes to the dashboard.
        authorized({ auth, request: { nextUrl } }) {
            const loggedIn = !!auth?.user;
            if (nextUrl.pathname === "/login") {
                return loggedIn ? Response.redirect(new URL("/", nextUrl)) : true;
            }
            return loggedIn;
        },
    },
} satisfies NextAuthConfig;