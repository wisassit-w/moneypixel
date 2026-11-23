"use client";

import { useActionState, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Coins, Eye, EyeOff, Loader2, Lock, Mail, User as UserIcon, type LucideIcon } from "lucide-react";
import { loginUser, registerUser, signInWithGoogle } from "@/app/actions/auth";
import { useLanguage } from "@/context/LanguageContext";

const inputCls =
    "w-full rounded-2xl border border-stone-200 bg-stone-50 py-2.5 pl-10 pr-3 text-sm text-stone-800 outline-none transition-all placeholder:text-stone-400 focus:border-sage-ink/50 focus:bg-card focus:ring-4 focus:ring-emerald-50";

// Google "G" logo (lucide has no brand icons)
function GoogleIcon() {
    return (
        <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
            <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
        </svg>
    );
}

function GoogleButton() {
    const { t } = useLanguage();
    const { pending } = useFormStatus(); // loading state of the surrounding <form>
    return (
        <button
            type="submit"
            disabled={pending}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-stone-200 bg-card py-3 text-sm font-semibold text-stone-700 shadow-sm transition-all hover:bg-stone-50 hover:shadow-md active:scale-[0.98] disabled:opacity-60"
        >
            {pending ? <Loader2 className="h-5 w-5 animate-spin text-sage-ink" /> : <GoogleIcon />}
            {t("auth.signInGoogle")}
        </button>
    );
}

function Field({ label, icon: Icon, children }: { label: string; icon: LucideIcon; children: ReactNode }) {
    return (
        <label className="block text-left">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-500">{label}</span>
            <span className="relative block">
                <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                {children}
            </span>
        </label>
    );
}

function PasswordField({
    name,
    label,
    autoComplete,
    strict,
}: {
    name: string;
    label: string;
    autoComplete: string;
    strict?: boolean; // sign-up: enforce the length rules in the browser too
}) {
    const { t } = useLanguage();
    const [show, setShow] = useState(false);
    return (
        <Field label={label} icon={Lock}>
            <input
                name={name}
                type={show ? "text" : "password"}
                required
                minLength={strict ? 8 : undefined}
                maxLength={72}
                autoComplete={autoComplete}
                className={`${inputCls} pr-11`}
            />
            <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? t("auth.hidePassword") : t("auth.showPassword")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-stone-400 transition-colors hover:text-stone-600"
            >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
        </Field>
    );
}

function SubmitButton({ pending, idle, busy }: { pending: boolean; idle: string; busy: string }) {
    return (
        <button
            type="submit"
            disabled={pending}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sage-600 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sage-700 active:scale-[0.98] disabled:opacity-70"
        >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {pending ? busy : idle}
        </button>
    );
}

/** Both forms stay mounted; the inactive one fades and slides out, so the tab switch is smooth. */
function Panel({ active, from, children }: { active: boolean; from: "left" | "right"; children: ReactNode }) {
    return (
        <div
            inert={!active}
            aria-hidden={!active}
            className={`transition-all duration-300 ${active
                    ? "relative translate-x-0 opacity-100"
                    : `pointer-events-none absolute inset-x-0 top-0 opacity-0 ${from === "left" ? "-translate-x-4" : "translate-x-4"}`
                }`}
        >
            {children}
        </div>
    );
}

function ErrorBox({ children }: { children: ReactNode }) {
    return (
        <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-left text-sm text-rose-700">
            {children}
        </p>
    );
}

export default function AuthForm() {
    const { t } = useLanguage();
    const params = useSearchParams();
    const urlError = params.get("error"); // set by Auth.js, e.g. OAuthAccountNotLinked

    const [tab, setTab] = useState<"signin" | "signup">("signin");
    // controlled, so they survive a failed submit (React clears uncontrolled fields after every action)
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");

    const [loginState, loginAction, loginPending] = useActionState(loginUser, null);
    const [registerState, registerAction, registerPending] = useActionState(registerUser, null);

    const urlMessage = urlError
        ? urlError === "OAuthAccountNotLinked"
            ? t("auth.error.linked")
            : t("auth.error.generic")
        : null;

    return (
        <div className="space-y-5">
            {urlMessage && <ErrorBox>{urlMessage}</ErrorBox>}

            {/* Tab switcher with a sliding highlight */}
            <div role="tablist" className="relative grid grid-cols-2 rounded-2xl bg-stone-100 p-1">
                <span
                    aria-hidden
                    className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-xl bg-card shadow-sm transition-transform duration-300 ${tab === "signup" ? "translate-x-full" : ""
                        }`}
                />
                {(["signin", "signup"] as const).map((id) => (
                    <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={tab === id}
                        onClick={() => setTab(id)}
                        className={`relative z-10 rounded-xl py-2 text-sm font-semibold transition-colors ${tab === id ? "text-sage-ink" : "text-stone-500 hover:text-stone-700"
                            }`}
                    >
                        {t(id === "signin" ? "auth.tabSignIn" : "auth.tabSignUp")}
                    </button>
                ))}
            </div>

            <div className="relative">
                {/* ---- Sign in ---- */}
                <Panel active={tab === "signin"} from="left">
                    <form action={loginAction} className="space-y-3">
                        <Field label={t("auth.email")} icon={Mail}>
                            <input
                                name="email"
                                type="email"
                                required
                                maxLength={254}
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={inputCls}
                            />
                        </Field>
                        <PasswordField name="password" label={t("auth.password")} autoComplete="current-password" />
                        {loginState?.error && <ErrorBox>{t(loginState.error)}</ErrorBox>}
                        <SubmitButton pending={loginPending} idle={t("auth.signInBtn")} busy={t("auth.signingIn")} />
                    </form>
                </Panel>

                {/* ---- Sign up ---- */}
                <Panel active={tab === "signup"} from="right">
                    <form action={registerAction} className="space-y-3">
                        <Field label={t("auth.name")} icon={UserIcon}>
                            <input
                                name="name"
                                type="text"
                                required
                                maxLength={40}
                                autoComplete="nickname"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className={inputCls}
                            />
                        </Field>
                        <Field label={t("auth.email")} icon={Mail}>
                            <input
                                name="email"
                                type="email"
                                required
                                maxLength={254}
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={inputCls}
                            />
                        </Field>
                        <PasswordField name="password" label={t("auth.password")} autoComplete="new-password" strict />
                        <PasswordField name="confirm" label={t("auth.confirm")} autoComplete="new-password" strict />
                        <p className="text-left text-xs text-stone-400">{t("auth.passwordHint")}</p>

                        <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-100/80 px-3 py-2 text-left text-xs font-medium text-amber-800">
                            <Coins className="h-4 w-4 shrink-0 text-amber-500" />
                            {t("auth.bonus")}
                        </p>

                        {registerState?.error && <ErrorBox>{t(registerState.error)}</ErrorBox>}
                        <SubmitButton pending={registerPending} idle={t("auth.signUpBtn")} busy={t("auth.creating")} />
                    </form>
                </Panel>
            </div>

            <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-stone-400">
                <span className="h-px flex-1 bg-stone-200" />
                {t("auth.or")}
                <span className="h-px flex-1 bg-stone-200" />
            </div>

            <form action={signInWithGoogle}>
                <GoogleButton />
            </form>
        </div>
    );
}