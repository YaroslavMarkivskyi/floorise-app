import { db } from "@/lib/db"
import type { WeightEntry, BodyMeasurement } from "@/generated/prisma/client"

export interface WeightRow {
  entry: WeightEntry
  delta: number | null
}

export interface MeasurementRow {
  entry: BodyMeasurement
  deltas: {
    bicep: number | null
    chest: number | null
    thigh: number | null
    waist: number | null
  }
}

export async function getWeightHistory(userId: string): Promise<WeightRow[]> {
  const entries = await db.weightEntry.findMany({
    where: { userId },
    orderBy: { date: "asc" },
  })

  return entries.map((entry, i) => {
    const prev = i > 0 ? entries[i - 1] : null
    const delta = prev
      ? Number(entry.kg) - Number(prev.kg)
      : null
    return { entry, delta }
  })
}

function decimalDelta(
  a: { toString(): string } | null,
  b: { toString(): string } | null,
): number | null {
  if (a === null || b === null) return null
  return Number(a) - Number(b)
}

export async function getMeasurementHistory(userId: string): Promise<MeasurementRow[]> {
  const entries = await db.bodyMeasurement.findMany({
    where: { userId },
    orderBy: { date: "asc" },
  })

  return entries.map((entry, i) => {
    const prev = i > 0 ? entries[i - 1] : null
    return {
      entry,
      deltas: {
        bicep: decimalDelta(entry.bicep, prev?.bicep ?? null),
        chest: decimalDelta(entry.chest, prev?.chest ?? null),
        thigh: decimalDelta(entry.thigh, prev?.thigh ?? null),
        waist: decimalDelta(entry.waist, prev?.waist ?? null),
      },
    }
  })
}

export interface DayStatus {
  date: Date
  label: string // "Пн", "Вт", …
  status: "strong" | "floor" | "open"
}

const UK_SHORT_DAYS = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]

export async function getWeekOverview(
  userId: string,
  today: Date,
  kcalFloor: number,
  kcalTarget: number,
): Promise<DayStatus[]> {
  // Build 7 UTC days ending today
  const days: Date[] = []
  for (let i = 6; i >= 0; i--) {
    days.push(new Date(today.getTime() - i * 86_400_000))
  }

  const start = days[0]
  const end = days[6]

  const logs = await db.mealLog.findMany({
    where: {
      userId,
      date: { gte: start, lte: end },
      done: true,
    },
    include: { chosenDish: true, slot: { include: { slotDishes: { include: { dish: true } } } } },
  })

  const slots = await db.mealSlot.findMany({
    where: { userId, active: true },
    include: { slotDishes: { include: { dish: true } } },
  })

  return days.map((day) => {
    const dayLogs = logs.filter(
      (l) => l.date.getTime() === day.getTime(),
    )

    let kcal = 0
    for (const log of dayLogs) {
      if (log.chosenDish) {
        kcal += log.chosenDish.kcal
      } else {
        const slot = slots.find((s) => s.id === log.slotId)
        if (slot) {
          const dayIndex = Math.floor(day.getTime() / 86_400_000)
          const idx = (dayIndex + slot.order) % (slot.slotDishes.length || 1)
          kcal += slot.slotDishes[idx]?.dish.kcal ?? 0
        }
      }
    }

    const jsDay = day.getUTCDay()
    return {
      date: day,
      label: UK_SHORT_DAYS[jsDay],
      status:
        kcal >= kcalTarget ? "strong" : kcal >= kcalFloor ? "floor" : "open",
    }
  })
}
