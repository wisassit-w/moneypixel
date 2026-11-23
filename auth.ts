import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import { STARTER_BILLS } from "@/lib/starterBills";
import { rateLimit } from "@/lib/rateLimit";
import { verifyPassword } from "@/lib/password";
import { isValidEmail, normalizeEmail } from "@/lib/validators";

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,

    // Google (from auth.config.ts) + email/password. Credentials lives here, not in auth.config.ts,
    // because bcrypt and the database must never be bundled into proxy.ts.
    providers: [
        ...authConfig.providers,
        Credentials({
            credentials: { email: {}, password: {} },

            // Runs for every email/password sign-in, including direct POSTs to /api/auth/callback/credentials,
            // so the strict checks live here, not only in the login form.
            async authorize(credentials) {
                const email = normalizeEmail(credentials?.email);
                const password = typeof credentials?.password === "string" ? credentials.password : "";
                if (!isValidEmail(email) || !password || password.length > 200) return null;

                // Backstop against password guessing: 20 tries per email per 15 minutes.
                // (The login action has a stricter limit with a friendly message.)
                if (!rateLimit(`auth:${email}`, 20, 15 * 60 * 1000).ok) return null;

                const user = await prisma.user.findUnique({ where: { email } });
                const valid = await verifyPassword(password, user?.password); // same cost whether the user exists or not
                if (!user || !valid) return null;

                // Only safe fields go into the session: never the password hash
                return { id: user.id, name: user.name, email: user.email, image: user.image };
            },
        }),
    ],

    // Users and Google accounts are stored in MySQL through Prisma
    adapter: PrismaAdapter(prisma),

    // JWT sessions: required for the Credentials provider, and lets proxy.ts check login from the cookie alone
    session: { strategy: "jwt" },

    callbacks: {
        ...authConfig.callbacks,

        // On sign-in, `user` is the database user; keep its id in the token
        jwt({ token, user }) {
            if (user?.id) token.sub = user.id;
            return token;
        },

        // Put user.id into the session so server actions can scope every query to it
        session({ session, token }) {
            if (token.sub) session.user.id = token.sub;
            return session;
        },
    },

    events: {
        // A new Google student gets the default dorm bills (coins start from the schema default of 100).
        // Email/password students get theirs inside registerUser.
        async createUser({ user }) {
            if (!user.id) return;
            await prisma.fixedBill.createMany({
                data: STARTER_BILLS.map((b) => ({ ...b, userId: user.id as string })),
            });
        },
    },
});