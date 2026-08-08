"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { generateWeeklyPlan, regenerateSinglePlannedDish } from "@/lib/ai-weekly"
import { getWeekStart } from "@/lib/plan"
import { getOrCreateListForWeek } from "@/lib/purchase"
import { STAPLES } from "@/lib/staples"

export type PlanActionState = { error: string } | { success: true } | null

// ─── generateDraftPlan ────────────────────────────────────────────────────────

export async function generateDraftPlan(
  _prevState: PlanActionState,
  formData: FormData,
): Promise<PlanActionState> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Не авторизовано" }
  const userId = session.user.id

  const userNotes = (formData.get("userNotes") as string | null) ?? undefined
  const weekParam = (formData.get("weekStart") as string | null) ?? undefined

  const profile = await db.profile.findUnique({
    where: { userId },
    select: { kcalFloor: true, kcalTarget: true, timezone: true },
  })
  const timezone = profile?.timezone ?? "Europe/Kyiv"
  const kcalFloor = profile?.kcalFloor ?? 2000
  const kcalTarget = profile?.kcalTarget ?? 2800

  const slots = await db.mealSlot.findMany({
    where: { userId, active: true },
    orderBy: { order: "asc" },
  })
  if (slots.length === 0) return { error: "Немає активних слотів" }

  // Use week from form if provided and valid (must be a Monday), else current week
  let weekStart: Date
  if (weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
    const candidate = new Date(`${weekParam}T00:00:00.000Z`)
    // Validate it's a Monday (getUTCDay() === 1)
    weekStart = candidate.getUTCDay() === 1 ? candidate : getWeekStart(new Date(), timezone)
  } else {
    weekStart = getWeekStart(new Date(), timezone)
  }

  const dishes = await generateWeeklyPlan({
    slots: slots.map((s) => ({
      slotId: s.id,
      name: s.name,
      time: s.time,
      targetKcal: s.targetKcal,
    })),
    kcalFloor,
    kcalTarget,
    userNotes,
  })

  if (!dishes) return { error: "Не вдалось згенерувати план. Спробуй ще." }

  // Upsert plan (replace existing draft for this week)
  await db.$transaction(async (tx) => {
    const existing = await tx.weeklyPlan.findUnique({
      where: { userId_weekStart: { userId, weekStart } },
    })
    if (existing) {
      await tx.plannedDish.deleteMany({ where: { planId: existing.id } })
      await tx.weeklyPlan.update({
        where: { id: existing.id },
        data: { userNotes, status: "draft", updatedAt: new Date() },
      })
      await tx.plannedDish.createMany({
        data: dishes.map((d) => ({
          planId: existing.id,
          slotId: d.slotId,
          dayOfWeek: d.dayOfWeek,
          name: d.name,
          kcal: d.kcal,
          proteins: d.proteins,
          fats: d.fats,
          carbs: d.carbs,
          cookTime: d.cookTime,
          ingredients: d.ingredients,
          steps: d.steps,
          source: d.source,
        })),
      })
    } else {
      await tx.weeklyPlan.create({
        data: {
          userId,
          weekStart,
          status: "draft",
          userNotes,
          plannedDishes: {
            createMany: {
              data: dishes.map((d) => ({
                slotId: d.slotId,
                dayOfWeek: d.dayOfWeek,
                name: d.name,
                kcal: d.kcal,
                proteins: d.proteins,
                fats: d.fats,
                carbs: d.carbs,
                cookTime: d.cookTime,
                ingredients: d.ingredients,
                steps: d.steps,
                source: d.source,
              })),
            },
          },
        },
      })
    }
  })

  revalidatePath("/plan")
  return { success: true }
}

// ─── approvePlan ──────────────────────────────────────────────────────────────

export async function approvePlan(planId: string): Promise<void> {
  const session = await auth()
  if (!session?.user?.id) return
  const userId = session.user.id

  const plan = await db.weeklyPlan.findUnique({
    where: { id: planId },
    include: { plannedDishes: true },
  })
  if (!plan || plan.userId !== userId || plan.status !== "draft") return

  await db.$transaction(async (tx) => {
    // Archive previous approved plans
    await tx.weeklyPlan.updateMany({
      where: { userId, status: "approved" },
      data: { status: "archived" },
    })

    // Approve this plan
    await tx.weeklyPlan.update({
      where: { id: planId },
      data: { status: "approved" },
    })
  })

  revalidatePath("/plan")
  revalidatePath("/purchase")
  revalidatePath("/today")
}

// ─── regenPlanSlot ────────────────────────────────────────────────────────────

const regenSchema = z.object({
  planId: z.string().min(1),
  slotId: z.string().min(1),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
})

export async function regenPlanSlot(
  _prevState: PlanActionState,
  formData: FormData,
): Promise<PlanActionState> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Не авторизовано" }
  const userId = session.user.id

  const parsed = regenSchema.safeParse({
    planId: formData.get("planId"),
    slotId: formData.get("slotId"),
    dayOfWeek: formData.get("dayOfWeek"),
  })
  if (!parsed.success) return { error: "Невірні дані" }

  const { planId, slotId, dayOfWeek } = parsed.data
  const userNote = (formData.get("userNote") as string | null) || undefined

  const plan = await db.weeklyPlan.findUnique({
    where: { id: planId },
    select: { userId: true, status: true },
  })
  if (!plan || plan.userId !== userId) return { error: "Не знайдено" }

  const slot = await db.mealSlot.findUnique({
    where: { id: slotId },
    select: { userId: true, name: true, time: true, targetKcal: true },
  })
  if (!slot || slot.userId !== userId) return { error: "Не знайдено" }

  const existing = await db.plannedDish.findUnique({
    where: { planId_slotId_dayOfWeek: { planId, slotId, dayOfWeek } },
  })

  // Approved plan: suggest from this week's unchecked shopping list
  let fromStock: string[] | undefined
  if (plan.status === "approved") {
    const fullPlan = await db.weeklyPlan.findUnique({ where: { id: planId }, select: { weekStart: true } })
    if (fullPlan) {
      const weekList = await getOrCreateListForWeek(userId, fullPlan.weekStart)
      fromStock = weekList.items.filter((i: { checked: boolean; name: string }) => !i.checked).map((i: { name: string }) => i.name)
    }
  }

  const generated = await regenerateSinglePlannedDish({
    slotName: slot.name,
    slotTime: slot.time,
    targetKcal: slot.targetKcal,
    dayOfWeek,
    currentName: (existing?.name as string) ?? "невідома страва",
    userNote,
    fromStock,
  })

  if (!generated) return { error: "Не вдалось згенерувати. Спробуй ще." }

  await db.plannedDish.upsert({
    where: { planId_slotId_dayOfWeek: { planId, slotId, dayOfWeek } },
    create: {
      planId,
      slotId,
      dayOfWeek,
      name: generated.name,
      kcal: generated.kcal,
      proteins: generated.proteins,
      fats: generated.fats,
      carbs: generated.carbs,
      cookTime: parseCookTime(generated.cookTime),
      ingredients: [],
      steps: [],
    },
    update: {
      name: generated.name,
      kcal: generated.kcal,
      proteins: generated.proteins,
      fats: generated.fats,
      carbs: generated.carbs,
      cookTime: parseCookTime(generated.cookTime),
      ingredients: [],
      steps: [],
    },
  })

  revalidatePath("/plan")
  revalidatePath("/today")
  return { success: true }
}

// ─── updateUserNotes ──────────────────────────────────────────────────────────

export async function updatePlanNotes(
  _prevState: PlanActionState,
  formData: FormData,
): Promise<PlanActionState> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Не авторизовано" }
  const userId = session.user.id

  const planId = formData.get("planId") as string
  const userNotes = (formData.get("userNotes") as string) || undefined

  if (!planId) return { error: "Невірні дані" }

  const plan = await db.weeklyPlan.findUnique({ where: { id: planId }, select: { userId: true } })
  if (!plan || plan.userId !== userId) return { error: "Не знайдено" }

  await db.weeklyPlan.update({ where: { id: planId }, data: { userNotes } })
  revalidatePath("/plan")
  return { success: true }
}

// ─── void wrappers for form actions ──────────────────────────────────────────

export async function triggerGenerateDraftPlan(formData: FormData): Promise<void> {
  await generateDraftPlan(null, formData)
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function parseCookTime(raw: string): number | null {
  const match = raw.match(/\d+/)
  return match ? parseInt(match[0], 10) : null
}
