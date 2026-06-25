"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getWeekStart } from "@/lib/plan"
import { getOrCreateListForWeek } from "@/lib/purchase"
import { STAPLES } from "@/lib/staples"
import type { ShoppingList, ShoppingItem } from "@/generated/prisma/client"

export type ShoppingListWithItems = ShoppingList & { items: ShoppingItem[] }
export type PurchaseActionState = { error: string } | { success: true } | null

// ─── toggleItem ───────────────────────────────────────────────────────────────

export async function toggleItem(
  _prevState: PurchaseActionState,
  formData: FormData,
): Promise<PurchaseActionState> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Не авторизовано" }

  const itemId = formData.get("itemId") as string | null
  if (!itemId) return { error: "Невірні дані" }

  const item = await db.shoppingItem.findUnique({
    where: { id: itemId },
    include: { list: { select: { userId: true } } },
  })
  if (!item || item.list.userId !== session.user.id) return { error: "Не знайдено" }

  await db.shoppingItem.update({
    where: { id: item.id },
    data: { checked: !item.checked },
  })

  revalidatePath("/purchase")
  return { success: true }
}

// ─── addItem ──────────────────────────────────────────────────────────────────

export async function addItem(
  _prevState: PurchaseActionState,
  formData: FormData,
): Promise<PurchaseActionState> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Не авторизовано" }
  const userId = session.user.id

  const name = (formData.get("name") as string | null)?.trim()
  if (!name) return { error: "Введіть назву" }

  const weekStartIso = formData.get("weekStart") as string | null
  if (!weekStartIso) return { error: "Невірні дані" }
  const weekStart = new Date(`${weekStartIso}T00:00:00.000Z`)

  const list = await getOrCreateListForWeek(userId, weekStart)

  await db.shoppingItem.create({
    data: { listId: list.id, name, source: "staple" },
  })

  revalidatePath("/purchase")
  return { success: true }
}

// ─── deleteItem ───────────────────────────────────────────────────────────────

export async function deleteItem(
  _prevState: PurchaseActionState,
  formData: FormData,
): Promise<PurchaseActionState> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Не авторизовано" }

  const itemId = (formData.get("itemId") as string | null)?.trim()
  if (!itemId) return { error: "Невірні дані" }

  const item = await db.shoppingItem.findUnique({
    where: { id: itemId },
    include: { list: { select: { userId: true } } },
  })
  if (!item || item.list.userId !== session.user.id) return { error: "Не знайдено" }

  await db.shoppingItem.delete({ where: { id: itemId } })

  revalidatePath("/purchase")
  return { success: true }
}

// ─── finishTrip ───────────────────────────────────────────────────────────────

export async function finishTrip(formData: FormData): Promise<void> {
  const session = await auth()
  if (!session?.user?.id) return
  const userId = session.user.id

  const weekStartIso = formData.get("weekStart") as string | null
  if (!weekStartIso) return
  const weekStart = new Date(`${weekStartIso}T00:00:00.000Z`)

  await db.shoppingList.updateMany({
    where: { userId, weekStart },
    data: { status: "done", closedAt: new Date() },
  })

  revalidatePath("/purchase")
}

// ─── syncFromPlan ─────────────────────────────────────────────────────────────

export async function syncFromPlan(formData: FormData): Promise<void> {
  const session = await auth()
  if (!session?.user?.id) return
  const userId = session.user.id

  const weekStartIso = formData.get("weekStart") as string | null
  if (!weekStartIso) return
  const weekStart = new Date(`${weekStartIso}T00:00:00.000Z`)

  const plan = await db.weeklyPlan.findFirst({
    where: { userId, weekStart, status: "approved" },
    include: {
      plannedDishes: {
        select: {
          id: true,
          name: true,
          kcal: true,
          cookTime: true,
          ingredients: true,
        },
      },
    },
  })
  if (!plan) return

  // Generate missing recipes in parallel batches of 5
  const { generateDishRecipe } = await import("@/lib/ai-weekly")

  const missing = plan.plannedDishes.filter(
    (d) => (d.ingredients as string[]).length === 0,
  )

  const BATCH = 5
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH)
    await Promise.all(
      batch.map(async (dish) => {
        const recipe = await generateDishRecipe({
          name: dish.name as string,
          kcal: dish.kcal as number,
          cookTime: dish.cookTime ? `${dish.cookTime} хв` : null,
        })
        if (!recipe) return
        await db.plannedDish.update({
          where: { id: dish.id },
          data: {
            portionWeight: recipe.portionWeight,
            ingredients: recipe.ingredients,
            steps: recipe.steps,
          },
        })
        // Update in-memory so we pick up the freshly generated ingredients below
        dish.ingredients = recipe.ingredients as unknown as typeof dish.ingredients
      }),
    )
  }

  // Collect all ingredients from all dishes
  const rawIngredients: string[] = []
  for (const dish of plan.plannedDishes) {
    rawIngredients.push(...(dish.ingredients as string[]).filter((s) => s.trim().length > 0))
  }
  if (rawIngredients.length === 0) return

  const list = await getOrCreateListForWeek(userId, weekStart)

  // Remove previously synced plan items before re-syncing
  await db.shoppingItem.deleteMany({ where: { listId: list.id, source: "meal_sync" } })

  const { aggregateShoppingList } = await import("@/lib/ai-purchase")
  const aggregated = await aggregateShoppingList(rawIngredients)
  if (aggregated.length === 0) return

  await db.shoppingItem.createMany({
    data: aggregated.map((item) => ({
      listId: list.id,
      name: item.name,
      qty: item.qty ?? undefined,
      category: "З плану тижня",
      source: "meal_sync" as const,
    })),
  })

  revalidatePath("/purchase")
  revalidatePath("/plan")
}

// ─── getOrCreateActiveList (kept for compat) ──────────────────────────────────

export async function getOrCreateActiveList(userId: string): Promise<ShoppingListWithItems> {
  const profile = await db.profile.findUnique({ where: { userId }, select: { timezone: true } })
  const tz = profile?.timezone ?? "Europe/Kyiv"
  const weekStart = getWeekStart(new Date(), tz)
  return getOrCreateListForWeek(userId, weekStart)
}
