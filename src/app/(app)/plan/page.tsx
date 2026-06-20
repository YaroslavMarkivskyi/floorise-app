import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { routes } from "@/lib/routes"
import { getApprovedPlan, getDraftPlan, getWeekStart, getDayOfWeek, getPlanHistory } from "@/lib/plan"
import { approvePlan } from "@/actions/plan"
import { WeekNav } from "@/components/WeekNav"
import { GeneratePlanForm } from "@/components/GeneratePlanForm"
import { PlanTable } from "@/components/PlanTable"
import type { PlanSlotRow, PlanDishCell } from "@/components/PlanTable"

function fmtDate(date: Date): string {
  return new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "short" }).format(date)
}

function fmtWeekRange(weekStart: Date): string {
  const weekEnd = new Date(weekStart.getTime() + 6 * 86_400_000)
  return `${fmtDate(weekStart)} – ${fmtDate(weekEnd)}`
}

function ApproveButton({ planId }: { planId: string }) {
  return (
    <form action={async () => { "use server"; await approvePlan(planId) }}>
      <button
        type="submit"
        className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
      >
        Затвердити план ✓
      </button>
    </form>
  )
}

interface Props {
  searchParams: Promise<{ week?: string }>
}

export default async function PlanPage({ searchParams }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect(routes.login)
  const userId = session.user.id

  const profile = await db.profile.findUnique({
    where: { userId },
    select: { timezone: true },
  })
  const timezone = profile?.timezone ?? "Europe/Kyiv"

  const params = await searchParams
  const currentWeekStart = getWeekStart(new Date(), timezone)

  let displayWeekStart: Date = currentWeekStart
  if (params.week && /^\d{4}-\d{2}-\d{2}$/.test(params.week)) {
    const candidate = new Date(`${params.week}T00:00:00.000Z`)
    if (candidate.getUTCDay() === 1) displayWeekStart = candidate
  }

  const currentWeekIso = currentWeekStart.toISOString().slice(0, 10)
  const displayWeekIso = displayWeekStart.toISOString().slice(0, 10)
  const isCurrentWeek = currentWeekIso === displayWeekIso
  const todayDow = getDayOfWeek(new Date(), timezone)

  const [approvedPlan, draftPlan, history] = await Promise.all([
    getApprovedPlan(userId, displayWeekStart),
    getDraftPlan(userId, displayWeekStart),
    getPlanHistory(userId),
  ])

  const plan = approvedPlan ?? draftPlan
  const isApproved = !!approvedPlan

  // Build week date labels once
  const weekDates = Array.from({ length: 7 }, (_, dow) =>
    fmtDate(new Date(displayWeekStart.getTime() + dow * 86_400_000)),
  )

  // Build PlanSlotRow[] for PlanTable
  const rows: PlanSlotRow[] = []
  if (plan) {
    const slotMap = new Map<string, PlanSlotRow>()
    for (const pd of plan.plannedDishes) {
      const slot = pd.slot as { id: string; name: string; time: string; order: number }

      if (!slotMap.has(slot.id)) {
        slotMap.set(slot.id, {
          id: slot.id,
          name: slot.name,
          time: slot.time,
          days: Array(7).fill(null),
        })
      }

      const cell: PlanDishCell = {
        planId: plan.id,
        slotId: pd.slotId,
        dayOfWeek: pd.dayOfWeek,
        name: pd.name as string,
        kcal: pd.kcal as number,
        proteins: pd.proteins as number | null,
        fats: pd.fats as number | null,
        carbs: pd.carbs as number | null,
        cookTime: pd.cookTime as number | null,
        portionWeight: pd.portionWeight as number | null,
        ingredients: pd.ingredients as string[],
        steps: pd.steps as string[],
      }

      slotMap.get(slot.id)!.days[pd.dayOfWeek] = cell
    }

    // Sort by slot order (preserved in insertion order from Prisma orderBy)
    rows.push(...slotMap.values())
  }

  return (
    <div className="space-y-6 px-2 py-5 pb-24 md:px-4 md:pb-5">
      {/* ─── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Тижневий план</h1>
          <p className="text-sm text-zinc-400">
            {fmtWeekRange(displayWeekStart)}
            {isCurrentWeek && (
              <span className="ml-2 text-xs font-medium text-zinc-500">· поточний</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {plan && isApproved && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              Затверджено ✓
            </span>
          )}
          {plan && !isApproved && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
              Чернетка
            </span>
          )}
          <WeekNav weekStart={displayWeekIso} isCurrentWeek={isCurrentWeek} />
        </div>
      </div>

      {/* ─── Generate form ───────────────────────────────────────────── */}
      <GeneratePlanForm hasExisting={!!plan} weekStartIso={displayWeekIso} />

      {/* ─── Plan table ──────────────────────────────────────────────── */}
      {rows.length > 0 && (
        <PlanTable
          rows={rows}
          isApproved={isApproved}
          isCurrentWeek={isCurrentWeek}
          todayDow={todayDow}
          weekDates={weekDates}
        />
      )}

      {/* ─── Approve button ──────────────────────────────────────────── */}
      {plan && !isApproved && (
        <div className="flex items-center gap-4">
          <ApproveButton planId={plan.id} />
          <p className="text-xs text-zinc-400">
            Після затвердження список покупок оновиться автоматично
          </p>
        </div>
      )}

      {/* ─── Empty state ─────────────────────────────────────────────── */}
      {!plan && (
        <div className="rounded-2xl border border-dashed border-zinc-200 p-10 text-center">
          <p className="text-sm text-zinc-400">
            {isCurrentWeek
              ? "Плану на цей тиждень ще немає. Натисни «Згенерувати» вище."
              : "Плану на цей тиждень немає."}
          </p>
        </div>
      )}

      {/* ─── History ─────────────────────────────────────────────────── */}
      {history.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Архів планів
            </h2>
            <span className="text-xs text-zinc-400 group-open:hidden">▸</span>
            <span className="hidden text-xs text-zinc-400 group-open:inline">▾</span>
          </summary>
          <div className="mt-3 space-y-2">
            {history.map((h) => {
              const iso = h.weekStart.toISOString().slice(0, 10)
              return (
                <a
                  key={h.id}
                  href={`/plan?week=${iso}`}
                  className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 hover:bg-zinc-50 transition-colors"
                >
                  <p className="text-sm font-semibold text-zinc-600">
                    Тиждень з {fmtDate(h.weekStart)}
                  </p>
                  <span className="text-xs text-zinc-400">архів ›</span>
                </a>
              )
            })}
          </div>
        </details>
      )}
    </div>
  )
}
