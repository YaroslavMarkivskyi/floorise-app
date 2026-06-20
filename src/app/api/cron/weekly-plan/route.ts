import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateWeeklyPlan } from "@/lib/ai-weekly"
import { getWeekStart } from "@/lib/plan"

// Vercel Cron: schedule = "0 21 * * 0" (Sun 21:00 UTC = Mon 00:00 Kyiv)
export const maxDuration = 60

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Verify Vercel Cron secret
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const users = await db.user.findMany({
    include: { profile: { select: { kcalFloor: true, kcalTarget: true, timezone: true } } },
  })

  let generated = 0
  let failed = 0

  for (const user of users) {
    const profile = user.profile
    const timezone = profile?.timezone ?? "Europe/Kyiv"
    const kcalFloor = profile?.kcalFloor ?? 2000
    const kcalTarget = profile?.kcalTarget ?? 2800

    const slots = await db.mealSlot.findMany({
      where: { userId: user.id, active: true },
      orderBy: { order: "asc" },
    })
    if (slots.length === 0) continue

    const weekStart = getWeekStart(new Date(), timezone)

    // Skip if plan already exists for this week
    const existing = await db.weeklyPlan.findUnique({
      where: { userId_weekStart: { userId: user.id, weekStart } },
    })
    if (existing) continue

    const dishes = await generateWeeklyPlan({
      slots: slots.map((s) => ({
        slotId: s.id,
        name: s.name,
        time: s.time,
        targetKcal: s.targetKcal,
      })),
      kcalFloor,
      kcalTarget,
    })

    if (!dishes) {
      failed++
      continue
    }

    await db.weeklyPlan.create({
      data: {
        userId: user.id,
        weekStart,
        status: "draft",
        plannedDishes: {
          createMany: {
            data: dishes.map((d) => ({
              slotId: d.slotId,
              dayOfWeek: d.dayOfWeek,
              name: d.name,
              kcal: d.kcal,
              cookTime: parseCookTime(d.cookTime),
              ingredients: [],
              steps: [],
            })),
          },
        },
      },
    })
    generated++
  }

  return NextResponse.json({ generated, failed })
}

function parseCookTime(raw: string): number | null {
  const match = raw.match(/\d+/)
  return match ? parseInt(match[0], 10) : null
}
