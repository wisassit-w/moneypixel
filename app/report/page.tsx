import { Suspense } from "react";
import { connection } from "next/server";
import { T } from "@/context/LanguageContext";
import { requireUserId } from "@/lib/session";
import { getMonthlySummary } from "@/lib/summary";
import { getActiveMonths } from "@/lib/activeMonths";
import { dateOfMonth, resolveMonth } from "@/lib/months";
import { monthKey } from "@/lib/time";
import MonthlyReport from "@/components/MonthlyReport";
import { MonthPicker } from "@/components/finance/FinanceFilters";

type SearchParams = Promise<{ month?: string | string[] }>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function ReportContent({ searchParams }: { searchParams: SearchParams }) {
    await connection();
    const userId = await requireUserId(); // MULTI-USER: only this student's data
    const sp = await searchParams;

    const months = await getActiveMonths(userId); // only months with transactions, plus the current month
    const month = resolveMonth(first(sp.month), months);
    const summary = await getMonthlySummary(userId, dateOfMonth(month));

    return (
        <>
            <MonthPicker state={{ month, currentMonth: monthKey(), months, type: "all", q: "" }} />
            <MonthlyReport summary={summary} />
        </>
    );
}

export default function ReportPage({ searchParams }: { searchParams: SearchParams }) {
    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <header>
                <h2 className="text-2xl font-bold text-stone-800">
                    <T k="dash.monthlyReport" />
                </h2>
                <p className="text-sm text-stone-500">
                    <T k="report.subtitle" />
                </p>
            </header>

            <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-stone-200/60" />}>
                <ReportContent searchParams={searchParams} />
            </Suspense>
        </div>
    );
}