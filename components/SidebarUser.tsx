import { connection } from "next/server";
import { LogOut } from "lucide-react";
import { auth } from "@/auth";
import { signOutAction } from "@/app/actions/auth";
import { T } from "@/context/LanguageContext";

/** The signed-in student's avatar and name, with a sign-out button. Rendered inside the sidebar. */
export default async function SidebarUser() {
    await connection();
    const user = (await auth())?.user;
    if (!user) return null;

    const label = user.name ?? user.email ?? "";

    return (
        <div className="mb-3 flex items-center gap-3 rounded-2xl border border-stone-100 bg-stone-50 p-3">
            {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt="" referrerPolicy="no-referrer" className="h-9 w-9 shrink-0 rounded-full object-cover" />
            ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-bold text-sage-ink">
                    {label.charAt(0).toUpperCase()}
                </div>
            )}

            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-stone-800">{label}</p>
                {user.name && user.email && <p className="truncate text-xs text-stone-500">{user.email}</p>}
            </div>

            <form action={signOutAction}>
                <button
                    type="submit"
                    className="rounded-lg p-2 text-stone-400 transition-colors hover:bg-card hover:text-rose-600"
                >
                    <LogOut className="h-4 w-4" />
                    <span className="sr-only">
                        <T k="auth.signOut" />
                    </span>
                </button>
            </form>
        </div>
    );
}