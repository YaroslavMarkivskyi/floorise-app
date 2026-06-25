import { db } from "@/lib/db"
import { STAPLES } from "@/lib/staples"
import type { ShoppingList, ShoppingItem } from "@/generated/prisma/client"

export type ShoppingListWithItems = ShoppingList & { items: ShoppingItem[] }

export async function getOrCreateListForWeek(
  userId: string,
  weekStart: Date,
): Promise<ShoppingListWithItems> {
  const existing = await db.shoppingList.findUnique({
    where: { userId_weekStart: { userId, weekStart } },
    include: { items: { orderBy: [{ category: "asc" }, { name: "asc" }] } },
  })
  if (existing) return existing

  return db.shoppingList.create({
    data: {
      userId,
      weekStart,
      items: { createMany: { data: STAPLES.map((s) => ({ ...s, source: "staple" })) } },
    },
    include: { items: { orderBy: [{ category: "asc" }, { name: "asc" }] } },
  })
}

export async function getListForWeek(
  userId: string,
  weekStart: Date,
): Promise<ShoppingListWithItems | null> {
  return db.shoppingList.findUnique({
    where: { userId_weekStart: { userId, weekStart } },
    include: { items: { orderBy: [{ category: "asc" }, { name: "asc" }] } },
  })
}

/** All weeks that have a list, newest first */
export async function getListWeeks(
  userId: string,
): Promise<Pick<ShoppingList, "weekStart">[]> {
  return db.shoppingList.findMany({
    where: { userId },
    orderBy: { weekStart: "desc" },
    select: { weekStart: true },
  })
}
