import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getUserSlots, getRotatedDish, getOrCreateMealLog, getDayLogs, getStreak } from "@/lib/nutrition"
import { TodayView } from "@/components/TodayView"
import { routes } from "@/lib/routes"
import { getApprovedPlan, getDraftPlan, getWeekStart, getDayOfWeek } from "@/lib/plan"
import type { PlannedDish } from "@/generated/prisma/client"

function utcToday(timezone: string): Date {
  const now = new Date()
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now).split("-")
  return new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])))
}

export default async function TodayPage() {
  const session = await auth()
  if (!session?.user?.id) redirect(routes.login)
  const userId = session.user.id

  const profile = await db.profile.findUnique({
    where: { userId },
    select: { kcalFloor: true, kcalTarget: true, timezone: true },
  })
  const timezone = profile?.timezone ?? "Europe/Kyiv"
  const kcalFloor = profile?.kcalFloor ?? 2000
  const kcalTarget = profile?.kcalTarget ?? 2800

  const today = utcToday(timezone)
  const dateIso = today.toISOString()

  const dateLabel = new Intl.DateTimeFormat("uk-UA", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date())

  const weekStart = getWeekStart(today, timezone)
  const dayOfWeek = getDayOfWeek(today, timezone)

  const [slots, dayLogs, streak, approvedPlan, draftPlan] = await Promise.all([
    getUserSlots(userId),
    getDayLogs(userId, today),
    getStreak(userId, today),
    getApprovedPlan(userId, weekStart),
    getDraftPlan(userId, weekStart),
  ])

  // Priority for dish source: MealLog.chosenDishId > approved plan > draft plan > rotation
  function getPlanDish(slotId: string): PlannedDish | null {
    const plan = approvedPlan ?? draftPlan
    if (!plan) return null
    return plan.plannedDishes.find((d) => d.slotId === slotId && d.dayOfWeek === dayOfWeek) ?? null
  }

  const slotItems = await Promise.all(
    slots.map(async (slot) => {
      const existingLog = dayLogs.find((l) => l.slotId === slot.id)
      const log = existingLog ?? (await getOrCreateMealLog(userId, today, slot.id))

      // 1. Manual override from per-slot regen
      if (log.chosenDishId) {
        const overrideDish = await db.dish.findUnique({ where: { id: log.chosenDishId } })
        if (overrideDish) {
          return {
            slotId: slot.id,
            slotTime: slot.time,
            slotName: slot.name,
            dishName: overrideDish.name,
            dishKcal: overrideDish.kcal,
            dishCookTime: overrideDish.cookTime ?? null,
            dishIngredients: (overrideDish.ingredients as string[]) ?? [],
            dishSteps: (overrideDish.steps as string[]) ?? [],
            initialDone: log.done,
          }
        }
      }

      // 2. Weekly plan (approved or draft)
      const planDish = getPlanDish(slot.id)
      if (planDish) {
        return {
          slotId: slot.id,
          slotTime: slot.time,
          slotName: slot.name,
          dishName: planDish.name,
          dishKcal: planDish.kcal,
          dishCookTime: planDish.cookTime ?? null,
          dishIngredients: (planDish.ingredients as string[]) ?? [],
          dishSteps: (planDish.steps as string[]) ?? [],
          initialDone: log.done,
        }
      }

      // 3. Default rotation
      const dish = getRotatedDish(slot, today)
      return {
        slotId: slot.id,
        slotTime: slot.time,
        slotName: slot.name,
        dishName: dish?.name ?? "—",
        dishKcal: dish?.kcal ?? 0,
        dishCookTime: dish?.cookTime ?? null,
        dishIngredients: (dish?.ingredients as string[] | null) ?? [],
        dishSteps: (dish?.steps as string[] | null) ?? [],
        initialDone: log.done,
      }
    }),
  )

  return (
    <TodayView
      slots={slotItems}
      dateIso={dateIso}
      kcalFloor={kcalFloor}
      kcalTarget={kcalTarget}
      dateLabel={dateLabel}
      initialStreak={streak}
    />
  )
}
