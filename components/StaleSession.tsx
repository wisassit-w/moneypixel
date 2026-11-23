import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { T } from "@/context/LanguageContext";

/** Shown when the session cookie is valid but the user row no longer exists (e.g. after a database reset). */
export default function StaleSession() {
    return (
        <div className="mx-auto mt-16 max-w-sm space-y-4 rounded-3xl border border-stone-100 bg-card p-8 text-center shadow-sm">
            <h2 className="text-lg font-bold text-stone-800">
                <T k="auth.staleTitle" />
            </h2>
            <p className="text-sm text-stone-500">
                <T k="auth.staleBody" />
            </p>
            <form action={signOutAction}>
                <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-2xl bg-sage-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sage-700 active:scale-95"
                >
                    <LogOut className="h-4 w-4" />
                    <T k="auth.signOut" />
                </button>
            </form>
        </div>
    );
}