import { db } from "@/lib/db"
import type { WeeklyPlan, PlannedDish, MealSlot } from "@/generated/prisma/client"

export type PlannedDishWithSlot = PlannedDish & { slot: MealSlot }
export type WeeklyPlanFull = WeeklyPlan & { plannedDishes: PlannedDishWithSlot[] }

export function getWeekStart(date: Date, timezone: string): Date {
  const local = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(date)
  const [y, m, d] = local.split("-").map(Number)
  const localMidnight = new Date(Date.UTC(y, m - 1, d))
  const dow = localMidnight.getUTCDay() // 0=Sun
  const daysFromMonday = dow === 0 ? 6 : dow - 1
  return new Date(localMidnight.getTime() - daysFromMonday * 86_400_000)
}

export function getDayOfWeek(date: Date, timezone: string): number {
  const local = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(date)
  const [y, m, d] = local.split("-").map(Number)
  const localMidnight = new Date(Date.UTC(y, m - 1, d))
  const dow = localMidnight.getUTCDay()
  return dow === 0 ? 6 : dow - 1 // 0=Mon … 6=Sun
}

async function getPlanForWeek(
  userId: string,
  weekStart: Date,
  status: "approved" | "draft",
): Promise<WeeklyPlanFull | null> {
  return db.weeklyPlan.findFirst({
    where: { userId, weekStart, status },
    include: {
      plannedDishes: {
        include: { slot: true },
        orderBy: [{ dayOfWeek: "asc" }, { slot: { order: "asc" } }],
      },
    },
  })
}

export async function getApprovedPlan(
  userId: string,
  weekStart: Date,
): Promise<WeeklyPlanFull | null> {
  return getPlanForWeek(userId, weekStart, "approved")
}

export async function getDraftPlan(
  userId: string,
  weekStart: Date,
): Promise<WeeklyPlanFull | null> {
  return getPlanForWeek(userId, weekStart, "draft")
}

export async function getCurrentPlan(
  userId: string,
  timezone: string,
): Promise<{ plan: WeeklyPlanFull | null; status: "approved" | "draft" | null }> {
  const weekStart = getWeekStart(new Date(), timezone)
  const approved = await getApprovedPlan(userId, weekStart)
  if (approved) return { plan: approved, status: "approved" }
  const draft = await getDraftPlan(userId, weekStart)
  if (draft) return { plan: draft, status: "draft" }
  return { plan: null, status: null }
}

export async function hasDraftPlan(userId: string, timezone: string): Promise<boolean> {
  const weekStart = getWeekStart(new Date(), timezone)
  const count = await db.weeklyPlan.count({ where: { userId, weekStart, status: "draft" } })
  return count > 0
}

export async function getPlanHistory(userId: string): Promise<WeeklyPlan[]> {
  return db.weeklyPlan.findMany({
    where: { userId, status: "archived" },
    orderBy: { weekStart: "desc" },
  })
}
