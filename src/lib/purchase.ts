import { db } from "@/lib/db"
import type { ShoppingList, ShoppingItem } from "@/generated/prisma/client"

export type ShoppingListWithItems = ShoppingList & {
  items: ShoppingItem[]
}

export async function getActiveList(userId: string): Promise<ShoppingListWithItems | null> {
  return db.shoppingList.findFirst({
    where: { userId, status: "active" },
    include: {
      items: { orderBy: [{ category: "asc" }, { name: "asc" }] },
    },
  })
}

export async function getPreviousList(userId: string): Promise<ShoppingListWithItems | null> {
  return db.shoppingList.findFirst({
    where: { userId, status: "done" },
    orderBy: { closedAt: "desc" },
    include: {
      items: { orderBy: [{ category: "asc" }, { name: "asc" }] },
    },
  })
}

export async function getListHistory(userId: string): Promise<ShoppingListWithItems[]> {
  return db.shoppingList.findMany({
    where: { userId, status: "done" },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  })
}
