"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import type { ShoppingList, ShoppingItem } from "@/generated/prisma/client"

export type ShoppingListWithItems = ShoppingList & { items: ShoppingItem[] }

// ─── Staple defaults ──────────────────────────────────────────────────────────

const STAPLES: { category: string; name: string }[] = [
  { category: "Молочне та яйця", name: "Молоко 3-4 л" },
  { category: "Молочне та яйця", name: "Яйця 2-3 десятки" },
  { category: "Молочне та яйця", name: "Сир твердий" },
  { category: "Молочне та яйця", name: "Творог" },
  { category: "Молочне та яйця", name: "Йогурт грецький" },
  { category: "Молочне та яйця", name: "Кефір" },
  { category: "Молочне та яйця", name: "Вершкове масло" },
  { category: "Білок", name: "Куряче філе або стегна" },
  { category: "Білок", name: "Яловичина або фарш" },
  { category: "Білок", name: "Риба заморожена" },
  { category: "Крупи та паста", name: "Вівсянка" },
  { category: "Крупи та паста", name: "Рис" },
  { category: "Крупи та паста", name: "Гречка" },
  { category: "Крупи та паста", name: "Макарони" },
  { category: "Крупи та паста", name: "Картопля" },
  { category: "Крупи та паста", name: "Хліб" },
  { category: "Горіхи та олія", name: "Горіхи мікс" },
  { category: "Горіхи та олія", name: "Арахісова паста" },
  { category: "Горіхи та олія", name: "Оливкова олія" },
  { category: "Горіхи та олія", name: "Мед" },
  { category: "Фрукти та овочі", name: "Банани 7-10 шт" },
  { category: "Фрукти та овочі", name: "Сухофрукти (фініки, родзинки, курага)" },
  { category: "Фрукти та овочі", name: "Овочі для гарніру" },
]

async function createListWithStaples(userId: string): Promise<ShoppingListWithItems> {
  const list = await db.shoppingList.create({
    data: {
      userId,
      items: {
        createMany: {
          data: STAPLES.map((s) => ({ ...s, source: "staple" })),
        },
      },
    },
    include: { items: true },
  })
  return list
}

// ─── getOrCreateActiveList ────────────────────────────────────────────────────

export async function getOrCreateActiveList(userId: string): Promise<ShoppingListWithItems> {
  const existing = await db.shoppingList.findFirst({
    where: { userId, status: "active" },
    include: { items: { orderBy: [{ category: "asc" }, { name: "asc" }] } },
  })
  if (existing) return existing
  return createListWithStaples(userId)
}

// ─── toggleItem ───────────────────────────────────────────────────────────────

const toggleSchema = z.object({ itemId: z.string().min(1) })

export type PurchaseActionState = { error: string } | { success: true } | null

export async function toggleItem(
  _prevState: PurchaseActionState,
  formData: FormData,
): Promise<PurchaseActionState> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Не авторизовано" }

  const parsed = toggleSchema.safeParse({ itemId: formData.get("itemId") })
  if (!parsed.success) return { error: "Невірні дані" }

  const item = await db.shoppingItem.findUnique({
    where: { id: parsed.data.itemId },
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

// ─── closeList ────────────────────────────────────────────────────────────────

const listIdSchema = z.object({ listId: z.string().min(1) })

export async function closeList(
  _prevState: PurchaseActionState,
  formData: FormData,
): Promise<PurchaseActionState> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Не авторизовано" }

  const parsed = listIdSchema.safeParse({ listId: formData.get("listId") })
  if (!parsed.success) return { error: "Невірні дані" }

  const list = await db.shoppingList.findUnique({
    where: { id: parsed.data.listId },
    select: { userId: true },
  })
  if (!list || list.userId !== session.user.id) return { error: "Не знайдено" }

  await db.shoppingList.update({
    where: { id: parsed.data.listId },
    data: { status: "done", closedAt: new Date() },
  })

  revalidatePath("/purchase")
  return { success: true }
}

// ─── createNewList ────────────────────────────────────────────────────────────

export async function createNewList(
  _prevState: PurchaseActionState,
  _formData: FormData,
): Promise<PurchaseActionState> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Не авторизовано" }
  const userId = session.user.id

  await db.shoppingList.updateMany({
    where: { userId, status: "active" },
    data: { status: "done", closedAt: new Date() },
  })

  await createListWithStaples(userId)

  revalidatePath("/purchase")
  return { success: true }
}

// ─── finishTrip — form action without prevState ───────────────────────────────

export async function finishTrip(_formData: FormData): Promise<void> {
  const session = await auth()
  if (!session?.user?.id) return
  const userId = session.user.id

  await db.shoppingList.updateMany({
    where: { userId, status: "active" },
    data: { status: "done", closedAt: new Date() },
  })

  await createListWithStaples(userId)
  revalidatePath("/purchase")
}
