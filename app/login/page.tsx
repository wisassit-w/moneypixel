import { Suspense } from "react";
import { PiggyBank, ShieldCheck } from "lucide-react";
import AuthForm from "@/components/auth/AuthForm";
import LanguageToggle from "@/components/LanguageToggle";
import { T } from "@/context/LanguageContext";

// The page itself is static. AuthForm reads ?error=... from the URL, so it sits in a Suspense boundary.
// The proxy sends signed-in users straight to the dashboard.
export default function LoginPage() {
    return (
        <div className="flex min-h-[85vh] items-center justify-center">
            <div className="w-full max-w-sm space-y-6 rounded-3xl border border-stone-100 bg-card p-6 text-center shadow-sm sm:p-8">
                <div className="flex justify-end">
                    <LanguageToggle />
                </div>

                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sage-600 text-white shadow-md">
                    <PiggyBank className="h-8 w-8" />
                </div>

                <div className="space-y-2">
                    <h1 className="text-2xl font-bold text-stone-800">
                        <T k="auth.welcome" />
                    </h1>
                    <p className="text-sm text-stone-500">
                        <T k="auth.tagline" />
                    </p>
                </div>

                <Suspense fallback={<div className="h-72 animate-pulse rounded-2xl bg-stone-100" />}>
                    <AuthForm />
                </Suspense>

                <p className="flex items-center justify-center gap-1.5 text-xs text-stone-500">
                    <ShieldCheck className="h-3.5 w-3.5 text-sage-ink" />
                    <T k="auth.privacy" />
                </p>
            </div>
        </div>
    );
}