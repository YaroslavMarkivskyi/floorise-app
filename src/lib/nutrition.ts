import { db } from "@/lib/db"
import type { Dish, MealLog, MealSlot, SlotDish } from "@/generated/prisma/client"

export type SlotWithDishes = MealSlot & {
  slotDishes: (SlotDish & { dish: Dish })[]
}

export async function getUserSlots(userId: string): Promise<SlotWithDishes[]> {
  return db.mealSlot.findMany({
    where: { userId, active: true },
    orderBy: { order: "asc" },
    include: {
      slotDishes: {
        orderBy: { position: "asc" },
        include: { dish: true },
      },
    },
  })
}

export function getRotatedDish(slot: SlotWithDishes, date: Date): Dish | null {
  const variants = slot.slotDishes
  if (variants.length === 0) return null
  const dayIndex = Math.floor(date.getTime() / 86_400_000)
  const idx = (dayIndex + slot.order) % variants.length
  return variants[idx].dish
}

export async function getOrCreateMealLog(
  userId: string,
  date: Date,
  slotId: string,
): Promise<MealLog> {
  // Strip time — store as date-only (midnight UTC)
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))

  return db.mealLog.upsert({
    where: { userId_date_slotId: { userId, date: day, slotId } },
    create: { userId, date: day, slotId, done: false },
    update: {},
  })
}

export async function getDayLogs(userId: string, date: Date): Promise<MealLog[]> {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  return db.mealLog.findMany({ where: { userId, date: day } })
}

export async function getStreak(userId: string, today: Date): Promise<number> {
  const profile = await db.profile.findUnique({
    where: { userId },
    select: { kcalFloor: true },
  })
  const floor = profile?.kcalFloor ?? 0

  const slots = await getUserSlots(userId)
  if (slots.length === 0) return 0

  let streak = 0
  const check = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))

  for (let i = 0; i < 365; i++) {
    const day = new Date(check.getTime() - i * 86_400_000)
    const logs = await getDayLogs(userId, day)

    const doneLogs = logs.filter((l) => l.done)
    const doneDishes = await Promise.all(
      doneLogs.map((l) => {
        if (l.chosenDishId) return db.dish.findUnique({ where: { id: l.chosenDishId } })
        const slot = slots.find((s) => s.id === l.slotId)
        if (!slot) return null
        return Promise.resolve(getRotatedDish(slot, day))
      }),
    )

    const kcalDay = doneDishes.reduce((sum, d) => sum + (d?.kcal ?? 0), 0)

    if (kcalDay >= floor) {
      streak++
    } else if (i > 0) {
      // today may still be in progress — only break on past days
      break
    }
  }

  return streak
}
