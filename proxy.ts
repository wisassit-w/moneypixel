import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// A light Auth.js instance with no database: it only checks the session cookie.
const { auth } = NextAuth(authConfig);

export const proxy = auth;

// Protect the app pages. /login is included so signed-in users skip it.
export const config = {
    matcher: ["/", "/finance/:path*", "/report/:path*", "/login"],
};