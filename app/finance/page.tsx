import { Suspense } from "react";
import { connection } from "next/server";
import { Coins, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import type { Prisma, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/categories";
import { formatCurrency } from "@/lib/format";
import { monthKey, monthRange } from "@/lib/time";
import { dateOfMonth, resolveMonth } from "@/lib/months";
import { getActiveMonths } from "@/lib/activeMonths";
import { budgetStatus } from "@/lib/mood";
import { getMonthlySummary } from "@/lib/summary";
import { translate } from "@/lib/translations";
import { T } from "@/context/LanguageContext";
import { requireUserId } from "@/lib/session";
import StatCard from "@/components/StatCard";
import MonthlySummaryModal from "@/components/MonthlySummaryModal";
import TransactionForm from "@/components/finance/TransactionForm";
import TransactionList from "@/components/finance/TransactionList";
import BillsTracker from "@/components/finance/BillsTracker";
import BudgetCard from "@/components/finance/BudgetCard";
import CategoryBreakdown from "@/components/finance/CategoryBreakdown";
import { MonthPicker, TransactionFilters, type FilterType } from "@/components/finance/FinanceFilters";

const LIST_LIMIT = 100; // rows shown in the list (the CSV export always contains everything)

type SumRows = { type: TransactionType; _sum: { amount: Prisma.Decimal | null } }[];
const sumOf = (rows: SumRows, type: TransactionType) => rows.find((r) => r.type === type)?._sum.amount?.toNumber() ?? 0;

type SearchParams = Promise<{ month?: string | string[]; type?: string | string[]; q?: string | string[] }>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function FinanceContent({ searchParams }: { searchParams: SearchParams }) {
    await connection(); // always render per request
    const userId = await requireUserId(); // MULTI-USER: only this student's data
    const sp = await searchParams;

    // --- read and validate the filters from the URL (never trust them) ---
    const currentMonth = monthKey();
    const months = await getActiveMonths(userId); // only months that have transactions, plus the current month
    const month = resolveMonth(first(sp.month), months); // anything else falls back to the current month
    const typeParam = first(sp.type);
    const type: FilterType = typeParam === "income" || typeParam === "expense" ? typeParam : "all";
    const q = (first(sp.q) ?? "").replace(/[%_\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 50);

    const { start, end } = monthRange(dateOfMonth(month));

    // Search matches the description, and the category in either language (so Thai names work too)
    const needle = q.toLowerCase();
    const matchedCategories = q
        ? Object.keys(CATEGORIES).filter((c) =>
            [c, translate("en", `cat.${c}`), translate("th", `cat.${c}`)].some((s) => s.toLowerCase().includes(needle)),
        )
        : [];

    const where: Prisma.TransactionWhereInput = {
        userId,
        date: { gte: start, lt: end },
        ...(type !== "all" ? { type } : {}),
        ...(q
            ? {
                OR: [
                    { description: { contains: q } },
                    ...(matchedCategories.length ? [{ category: { in: matchedCategories } }] : []),
                ],
            }
            : {}),
    };

    const [user, allTime, summary, byCategory, rows, listTotal, bills] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId } }),
        prisma.transaction.groupBy({ by: ["type"], where: { userId }, _sum: { amount: true } }),
        getMonthlySummary(userId, dateOfMonth(month)), // income / expense of the selected month
        prisma.transaction.groupBy({
            by: ["category"],
            where: { userId, type: "expense", date: { gte: start, lt: end } },
            _sum: { amount: true },
            orderBy: { _sum: { amount: "desc" } },
        }),
        prisma.transaction.findMany({ where, orderBy: [{ date: "desc" }, { id: "desc" }], take: LIST_LIMIT }),
        prisma.transaction.count({ where }),
        prisma.fixedBill.findMany({ where: { userId }, orderBy: { id: "asc" } }),
    ]);

    if (!user) {
        return (
            <p className="text-stone-500">
                <T k="common.noUser" />
            </p>
        );
    }

    const netBalance = sumOf(allTime, "income") - sumOf(allTime, "expense");

    // budget status for the "Spent" card
    const spentStatus = budgetStatus(summary.expense, user.monthlyBudget);
    const spentPct = user.monthlyBudget > 0 ? Math.round((summary.expense / user.monthlyBudget) * 100) : 0;

    const items = rows.map((t) => ({
        id: t.id,
        type: t.type,
        category: t.category,
        description: t.description,
        amountLabel: `${t.type === "income" ? "+" : "-"}${formatCurrency(t.amount.toNumber())}`,
        dateIso: t.date.toISOString(), // formatted on the client so it follows the language
    }));

    const billItems = bills.map((b) => ({
        id: b.id,
        name: b.name,
        icon: b.icon, // icon key, e.g. "home"
        amount: b.amount.toNumber(),
        paid: b.paidMonth === currentMonth, // bills always show the current month's status
    }));

    const breakdown = byCategory.map((r) => ({ category: r.category, amount: r._sum.amount?.toNumber() ?? 0 }));

    const filtered = q !== "" || type !== "all";
    const emptyKey = filtered ? "fin.noResults" : month === currentMonth ? "fin.empty" : "fin.emptyMonth";
    const filterState = { month, currentMonth, months, type, q };

    return (
        <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    label={<T k="fin.netBalance" />}
                    value={formatCurrency(netBalance)}
                    icon={<Wallet className="h-5 w-5 text-stone-600" />}
                    tone="stone"
                />
                <StatCard
                    label={<T k="sum.income" />}
                    value={formatCurrency(summary.income)}
                    icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
                    tone="sage"
                />
                <StatCard
                    label={<T k="sum.spent" />}
                    value={formatCurrency(summary.expense)}
                    icon={<TrendingDown className="h-5 w-5 text-orange-700" />}
                    tone="clay"
                    status={spentStatus === "none" ? undefined : spentStatus}
                    hint={
                        spentStatus === "none" ? undefined : (
                            <>
                                <T k={`budget.${spentStatus}`} /> · {spentPct}%
                            </>
                        )
                    }
                />
                <StatCard
                    label={<T k="fin.coinsEarned" />}
                    value={`${user.totalCoins}`}
                    icon={<Coins className="h-5 w-5 text-amber-500" />}
                    tone="amber"
                />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <MonthPicker state={filterState} />
                <div className="[&>button]:min-h-11">
                    <MonthlySummaryModal summary={summary} />
                </div>
            </div>

            {/*
              Balanced layout:
              - below xl: one column (Budget and Category side by side at lg), the long list last on phones
              - xl and up: left column = Budget, Category, Bills; right column = Transactions spanning the whole
                height with its own scroll, so both columns end on the same line and no gap is left
            */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-12">
                <div className="xl:col-span-5 xl:col-start-1 [&>*]:h-full">
                    <BudgetCard budget={user.monthlyBudget} spent={summary.expense} isCurrentMonth={month === currentMonth} />
                </div>

                <div className="xl:col-span-5 xl:col-start-1 [&>*]:h-full">
                    <CategoryBreakdown items={breakdown} />
                </div>

                <div className="lg:col-span-2 xl:col-span-5 xl:col-start-1 [&>*]:h-full">
                    <BillsTracker bills={billItems} />
                </div>

                <section className="flex flex-col rounded-2xl border border-stone-100 bg-card p-5 shadow-sm transition-all hover:shadow-md lg:col-span-2 xl:col-span-7 xl:col-start-6 xl:row-span-3 xl:row-start-1 xl:min-h-0 xl:overflow-hidden">
                    <h3 className="mb-3 font-bold text-stone-800">
                        <T k="fin.recent" />
                    </h3>
                    <TransactionFilters state={filterState} />

                    {/* below xl the list has a height cap; at xl it fills the card and scrolls inside it */}
                    <div className="max-h-[32rem] overflow-y-auto pr-1 xl:max-h-none xl:min-h-0 xl:flex-1 xl:basis-0">
                        <TransactionList items={items} emptyKey={emptyKey} />
                    </div>

                    {(filtered || listTotal > items.length) && listTotal > 0 && (
                        <p className="mt-3 text-center text-xs text-stone-500">
                            <T k="filter.showing" vars={{ shown: items.length, total: listTotal }} />
                        </p>
                    )}
                </section>
            </div>
        </>
    );
}

function FinanceSkeleton() {
    return (
        <div className="animate-pulse space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-24 rounded-2xl bg-stone-200/60" />
                ))}
            </div>
            <div className="h-11 w-64 rounded-xl bg-stone-200/60" />
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                <div className="space-y-6 xl:col-span-5">
                    <div className="h-48 rounded-2xl bg-stone-200/60" />
                    <div className="h-64 rounded-2xl bg-stone-200/60" />
                    <div className="h-72 rounded-2xl bg-stone-200/60" />
                </div>
                <div className="h-96 rounded-2xl bg-stone-200/60 xl:col-span-7" />
            </div>
        </div>
    );
}

export default function FinancePage({ searchParams }: { searchParams: SearchParams }) {
    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <header className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-stone-800">
                        <T k="fin.title" />
                    </h2>
                    <p className="text-sm text-stone-500">
                        <T k="fin.subtitle" />
                    </p>
                </div>
                <div className="[&>button]:min-h-11">
                    <TransactionForm />
                </div>
            </header>

            {/* searchParams is dynamic data, so it is read inside the Suspense boundary */}
            <Suspense fallback={<FinanceSkeleton />}>
                <FinanceContent searchParams={searchParams} />
            </Suspense>
        </div>
    );
}