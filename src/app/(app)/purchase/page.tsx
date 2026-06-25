import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { routes } from "@/lib/routes"
import { finishTrip, syncFromPlan } from "@/actions/purchase"
import { getOrCreateListForWeek, getListForWeek } from "@/lib/purchase"
import { getWeekStart, getDayOfWeek } from "@/lib/plan"
import { CheckboxItem } from "@/components/CheckboxItem"
import { AddItemForm } from "@/components/AddItemForm"
import { PurchaseNav } from "@/components/PurchaseNav"
import type { ShoppingItem } from "@/generated/prisma/client"
import { db } from "@/lib/db"

function fmtDate(date: Date): string {
  return new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "short" }).format(date)
}

function fmtWeekRange(weekStart: Date): string {
  const weekEnd = new Date(weekStart.getTime() + 6 * 86_400_000)
  return `${fmtDate(weekStart)} – ${fmtDate(weekEnd)}`
}

function groupByCategory(items: ShoppingItem[]): [string, ShoppingItem[]][] {
  const priority = ["З плану тижня"]
  const map = new Map<string, ShoppingItem[]>()
  for (const item of items) {
    const cat = item.category ?? "Інше"
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(item)
  }
  const sorted: [string, ShoppingItem[]][] = []
  for (const cat of priority) {
    if (map.has(cat)) { sorted.push([cat, map.get(cat)!]); map.delete(cat) }
  }
  sorted.push(...map.entries())
  return sorted
}

const CATEGORY_COLORS: Record<string, string> = {
  "З плану тижня":   "border-emerald-200 bg-emerald-50/60",
  "М'ясо та риба":   "border-red-200    bg-red-50/40",
  "Молочне та яйця": "border-amber-200  bg-amber-50/40",
  "Крупи та зернові":"border-orange-200 bg-orange-50/40",
  "Овочі та фрукти": "border-green-200  bg-green-50/40",
  "Бакалія":         "border-blue-200   bg-blue-50/40",
  "Інше":            "border-zinc-200   bg-white",
}

function categoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] ?? "border-zinc-200 bg-white"
}

function ListSection({ category, items, isCurrentWeek }: {
  category: string
  items: ShoppingItem[]
  isCurrentWeek: boolean
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">{category}</p>
        <span className="text-xs text-zinc-300">{items.length}</span>
      </div>
      <div className={`divide-y divide-zinc-100/80 rounded-2xl border px-4 ${categoryColor(category)}`}>
        {items.map((item) =>
          isCurrentWeek ? (
            <CheckboxItem
              key={item.id}
              itemId={item.id}
              name={item.name}
              qty={item.qty}
              initialChecked={item.checked}
            />
          ) : (
            <div key={item.id} className="flex items-center gap-3 py-2">
              <div
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2"
                style={item.checked
                  ? { borderColor: "#10b981", backgroundColor: "#10b981" }
                  : { borderColor: "#d1d5db", backgroundColor: "#ffffff" }}
              >
                {item.checked && (
                  <svg viewBox="0 0 10 8" className="h-3 w-3 fill-none stroke-white stroke-2">
                    <polyline points="1,4 4,7 9,1" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className={`text-sm ${item.checked ? "text-zinc-400 line-through" : "text-zinc-700"}`}>
                {item.name}
              </span>
              {item.qty && <span className="text-xs text-zinc-400">{item.qty}</span>}
            </div>
          )
        )}
      </div>
    </div>
  )
}

interface Props {
  searchParams: Promise<{ week?: string }>
}

export default async function PurchasePage({ searchParams }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect(routes.login)
  const userId = session.user.id

  const profile = await db.profile.findUnique({ where: { userId }, select: { timezone: true } })
  const tz = profile?.timezone ?? "Europe/Kyiv"

  const params = await searchParams
  const currentWeekStart = getWeekStart(new Date(), tz)
  const currentWeekIso = currentWeekStart.toISOString().slice(0, 10)

  let displayWeekStart = currentWeekStart
  if (params.week && /^\d{4}-\d{2}-\d{2}$/.test(params.week)) {
    const candidate = new Date(`${params.week}T00:00:00.000Z`)
    if (candidate.getUTCDay() === 1) displayWeekStart = candidate
  }

  const displayWeekIso = displayWeekStart.toISOString().slice(0, 10)
  const isCurrentWeek = currentWeekIso === displayWeekIso

  // Current week: auto-create list. Past weeks: only show if exists.
  const list = isCurrentWeek
    ? await getOrCreateListForWeek(userId, displayWeekStart)
    : await getListForWeek(userId, displayWeekStart)

  const approvedPlan = await db.weeklyPlan.findFirst({
    where: { userId, weekStart: displayWeekStart, status: "approved" },
    select: { id: true },
  })

  const hasPrev = true
  const hasNext = true

  const items = list?.items ?? []
  const checkedCount = items.filter((i) => i.checked).length
  const totalCount = items.length
  const progress = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0
  const groups = groupByCategory(items)

  const planGroups = groups.filter(([cat]) => cat === "З плану тижня")
  const otherGroups = groups.filter(([cat]) => cat !== "З плану тижня")

  return (
    <div className="px-4 py-5 pb-28 md:pb-6 space-y-4">

      {/* ─── Top bar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Список покупок</h1>
          <p className="text-sm text-zinc-400">{fmtWeekRange(displayWeekStart)}</p>
        </div>

        <PurchaseNav
          weekStart={displayWeekIso}
          isCurrentWeek={isCurrentWeek}
          hasPrev={hasPrev}
          hasNext={hasNext}
        />

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          {approvedPlan && (
            <form action={syncFromPlan}>
              <input type="hidden" name="weekStart" value={displayWeekIso} />
              <button
                type="submit"
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 whitespace-nowrap"
              >
                ↓ З плану
              </button>
            </form>
          )}
          {list && (
            <form action={finishTrip}>
              <input type="hidden" name="weekStart" value={displayWeekIso} />
              <button
                type="submit"
                className="rounded-xl bg-zinc-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-700 whitespace-nowrap"
              >
                Завершити ✓
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ─── Progress + Add form ─────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3">
        <div className="flex min-w-[12rem] flex-1 items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-semibold text-zinc-500">{checkedCount}/{totalCount}</span>
        </div>
        <div className="w-full sm:w-64">
          <AddItemForm weekStart={displayWeekIso} />
        </div>
      </div>

      {/* ─── List: plan left, categories right ───────────────── */}
      {groups.length > 0 ? (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex-1 min-w-0 space-y-6">
            {planGroups.map(([cat, items]) => (
              <ListSection key={cat} category={cat} items={items} isCurrentWeek={isCurrentWeek} />
            ))}
          </div>
          <div className="flex-1 min-w-0 space-y-6">
            {otherGroups.map(([cat, items]) => (
              <ListSection key={cat} category={cat} items={items} isCurrentWeek={isCurrentWeek} />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-200 p-10 text-center">
          <p className="text-sm text-zinc-400">
            {isCurrentWeek ? "Список порожній" : "Списку на цей тиждень немає"}
          </p>
        </div>
      )}
    </div>
  )
}
