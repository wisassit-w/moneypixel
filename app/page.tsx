import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { CheckCircle2, Coins, House, ListChecks, Target, TriangleAlert, Zap } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getMonthlySummary } from "@/lib/summary";
import { getQuestProgress } from "@/lib/questState";
import { asGender, asPet, csv } from "@/lib/catalog";
import { EXP_PER_LEVEL, expInLevel, levelFromExp } from "@/lib/exp";
import { budgetStatus, roomMood, type BudgetStatus } from "@/lib/mood";
import { T } from "@/context/LanguageContext";
import { requireUserId } from "@/lib/session";
import VirtualRoom from "@/components/VirtualRoom";
import RoomMood from "@/components/RoomMood";
import StatCard from "@/components/StatCard";
import TransactionForm from "@/components/finance/TransactionForm";
import FinanceQuestBoard from "@/components/finance/FinanceQuestBoard";

const TEXT: Record<BudgetStatus, string> = {
  ok: "text-emerald-800",
  warn: "text-amber-800",
  over: "text-rose-700",
  none: "text-stone-600",
};

const itemCls = "inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold hover:underline";

/** One clean line: budget status (links to Finance) and quest status (scrolls to the quests). */
function StatusLine({
  status,
  pct,
  ready,
  claimed,
  total,
}: {
  status: BudgetStatus;
  pct: number;
  ready: number;
  claimed: number;
  total: number;
}) {
  const BudgetIcon = status === "none" ? Target : status === "ok" ? CheckCircle2 : TriangleAlert;
  const allDone = total > 0 && claimed === total;

  return (
    <div className="flex flex-wrap items-center gap-x-5">
      <Link href="/finance" className={`${itemCls} ${TEXT[status]}`}>
        <BudgetIcon className="h-4 w-4 shrink-0" aria-hidden />
        {status === "none" ? (
          <T k="dash.budgetSet" />
        ) : (
          <span>
            <T k="dash.budget" />: <T k={`budget.${status}`} /> · {pct}%
          </span>
        )}
      </Link>

      <a href="#quests" className={`${itemCls} ${ready > 0 ? "text-amber-800" : allDone ? "text-emerald-800" : "text-stone-600"}`}>
        {ready > 0 ? (
          <Coins className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
        ) : allDone ? (
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <ListChecks className="h-4 w-4 shrink-0" aria-hidden />
        )}
        {ready > 0 ? (
          <T k="dash.questsReady" vars={{ n: ready }} />
        ) : allDone ? (
          <T k="dash.questsAllDone" />
        ) : (
          <T k="dash.questsProgress" vars={{ done: claimed, total }} />
        )}
      </a>
    </div>
  );
}

async function DashboardContent() {
  await connection();
  const userId = await requireUserId(); // MULTI-USER: only this student's data
  const [user, summary, quests] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    getMonthlySummary(userId),
    getQuestProgress(userId),
  ]);

  if (!user) {
    return (
      <p className="text-stone-500">
        <T k="common.noUser" />
      </p>
    );
  }

  const petType = asPet(user.petType);
  const level = levelFromExp(user.exp);
  const expNow = expInLevel(user.exp);

  // status and mood come from data we already load (no extra queries)
  const status = budgetStatus(summary.expense, user.monthlyBudget);
  const budgetPct = user.monthlyBudget > 0 ? Math.round((summary.expense / user.monthlyBudget) * 100) : 0;
  const readyCount = quests.filter((q) => q.done && !q.claimed).length;
  const claimedCount = quests.filter((q) => q.claimed).length;
  const mood = roomMood(status, quests.length > 0 && claimedCount === quests.length);

  return (
    <>
      <header>
        <h2 className="text-2xl font-bold text-stone-800">
          <T k="dash.welcome" vars={{ name: user.name?.split(" ")[0] ?? "Player" }} />
        </h2>
        <p className="text-sm text-stone-500">
          <T k="dash.subtitle" />
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard
          label={<T k="dash.coins" />}
          value={`${user.totalCoins}`}
          icon={<Coins className="h-5 w-5 text-amber-500" />}
          tone="amber"
        />
        <StatCard
          label={<T k="dash.energy" />}
          value={`${user.energyLevel}%`}
          icon={<Zap className="h-5 w-5 text-amber-500" />}
          tone="stone"
        />
        <div className="col-span-2 sm:col-span-1">
          <StatCard
            label={<T k="dash.roomLevel" />}
            value={<T k="dash.level" vars={{ n: level }} />}
            hint={<T k="dash.expProgress" vars={{ cur: expNow, max: EXP_PER_LEVEL }} />}
            icon={<House className="h-5 w-5 text-emerald-600" />}
            tone="sage"
            progress={(expNow / EXP_PER_LEVEL) * 100}
          />
        </div>
      </div>

      {/* The centerpiece: your room, with the main action and a single status line. Shop, Wardrobe and Piggy Bank live in the sidebar. */}
      <RoomMood
        mood={mood}
        header={
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <h3 className="font-bold text-stone-800">
                <T k="dash.roomTitle" />
              </h3>
              <StatusLine
                status={status}
                pct={budgetPct}
                ready={readyCount}
                claimed={claimedCount}
                total={quests.length}
              />
            </div>
            <div className="[&>button]:min-h-11">
              <TransactionForm />
            </div>
          </div>
        }
      >
        <VirtualRoom
          gender={asGender(user.gender)}
          hatId={user.hatId}
          shirtId={user.shirtId}
          pantsId={user.pantsId}
          shoesId={user.shoesId}
          owned={{
            hat: csv(user.ownedHats),
            shirt: csv(user.ownedShirts),
            pants: csv(user.ownedPants),
            shoes: csv(user.ownedShoes),
          }}
          furniture={{
            bed: user.hasBed,
            sofa: user.hasSofa,
            tv: user.hasTv,
            treadmill: user.hasTreadmill,
            desk: user.hasDesk,
            wardrobe: user.hasWardrobe,
          }}
          pet={{ type: petType, name: user.petName }}
          savings={{
            name: user.savingsGoalName,
            target: user.savingsGoalTarget,
            current: user.savingsCurrent,
          }}
          coins={user.totalCoins}
        />
      </RoomMood>

      <FinanceQuestBoard quests={quests} />
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-64 rounded-xl bg-stone-200/60" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="h-24 rounded-2xl bg-stone-200/60" />
        <div className="h-24 rounded-2xl bg-stone-200/60" />
        <div className="col-span-2 h-24 rounded-2xl bg-stone-200/60 sm:col-span-1" />
      </div>
      <div className="aspect-[16/10] rounded-2xl bg-stone-200/60" />
      <div className="h-48 rounded-2xl bg-stone-200/60" />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}