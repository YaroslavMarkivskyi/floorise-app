import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getUserSlots, getRotatedDish, getOrCreateMealLog, getDayLogs, getStreak } from "@/lib/nutrition"
import { TodayView } from "@/components/TodayView"
import { routes } from "@/lib/routes"

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

  const [slots, dayLogs, streak] = await Promise.all([
    getUserSlots(userId),
    getDayLogs(userId, today),
    getStreak(userId, today),
  ])

  const slotItems = await Promise.all(
    slots.map(async (slot) => {
      const dish = getRotatedDish(slot, today)
      const existingLog = dayLogs.find((l) => l.slotId === slot.id)
      const log = existingLog ?? (await getOrCreateMealLog(userId, today, slot.id))
      const activeDish = log.chosenDishId
        ? (slot.slotDishes.find((sd) => sd.dishId === log.chosenDishId)?.dish ?? dish)
        : dish
      return {
        slotId: slot.id,
        slotTime: slot.time,
        slotName: slot.name,
        dishName: activeDish?.name ?? "—",
        dishKcal: activeDish?.kcal ?? 0,
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
