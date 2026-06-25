import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { regenerateDish } from "@/lib/ai"
import { checkAndDecrement } from "@/lib/regen-quota"
import { getUserSlots, getRotatedDish } from "@/lib/nutrition"
import { getOrCreateListForWeek } from "@/lib/purchase"
import { getWeekStart } from "@/lib/plan"

const bodySchema = z.object({
  slotId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

function parseCookTimeMinutes(raw: string): number | null {
  const match = raw.match(/\d+/)
  return match ? parseInt(match[0], 10) : null
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизовано" }, { status: 401 })
  }
  const userId = session.user.id

  if (!checkAndDecrement(userId)) {
    return NextResponse.json(
      { error: "Ліміт регенерацій на сьогодні вичерпано (20/день)" },
      { status: 429 },
    )
  }

  const body = bodySchema.safeParse(await req.json())
  if (!body.success) {
    return NextResponse.json({ error: "Невірні дані" }, { status: 400 })
  }
  const { slotId, date } = body.data

  // Ownership check
  const slot = await db.mealSlot.findUnique({
    where: { id: slotId },
    include: { slotDishes: { orderBy: { position: "asc" }, include: { dish: true } } },
  })
  if (!slot || slot.userId !== userId) {
    return NextResponse.json({ error: "Не знайдено" }, { status: 404 })
  }

  const dateObj = new Date(`${date}T00:00:00.000Z`)

  // Current dish (override or rotation)
  const log = await db.mealLog.findUnique({
    where: { userId_date_slotId: { userId, date: dateObj, slotId } },
    include: { chosenDish: true },
  })

  const slots = await getUserSlots(userId)
  const fullSlot = slots.find((s) => s.id === slotId)
  const currentDish = log?.chosenDish ?? (fullSlot ? getRotatedDish(fullSlot, dateObj) : null)

  // fromStock — unchecked items from this week's shopping list
  const fromStockParam = new URL(req.url).searchParams.get("fromStock") === "true"
  let fromStock: string[] | undefined
  if (fromStockParam) {
    const profile = await db.profile.findUnique({ where: { userId }, select: { timezone: true } })
    const weekStart = getWeekStart(new Date(), profile?.timezone ?? "Europe/Kyiv")
    const weekList = await getOrCreateListForWeek(userId, weekStart)
    fromStock = weekList.items.filter((i) => !i.checked).map((i) => i.name)
  }

  const generated = await regenerateDish({
    slotName: slot.name,
    slotTime: slot.time,
    targetKcal: slot.targetKcal,
    currentDishName: currentDish?.name ?? "невідома страва",
    fromStock,
  })

  if (!generated) {
    return NextResponse.json(
      { error: "Не вдалось згенерувати. Спробуй ще." },
      { status: 500 },
    )
  }

  const newDish = await db.dish.create({
    data: {
      userId,
      name: generated.name,
      kcal: generated.kcal,
      cookTime: parseCookTimeMinutes(generated.cookTime),
      source: "ai",
      ingredients: generated.ingredients,
      steps: generated.steps,
    },
  })

  await db.mealLog.upsert({
    where: { userId_date_slotId: { userId, date: dateObj, slotId } },
    create: { userId, date: dateObj, slotId, chosenDishId: newDish.id, done: false },
    update: { chosenDishId: newDish.id },
  })

  revalidatePath("/today")

  return NextResponse.json({
    dish: {
      name: generated.name,
      kcal: generated.kcal,
      cookTime: generated.cookTime,
      ingredients: generated.ingredients,
      steps: generated.steps,
    },
  })
}
