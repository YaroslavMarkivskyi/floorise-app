"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getOrCreateMealLog } from "@/lib/nutrition"

export type ToggleResult = { success: true; done: boolean } | { error: string }

export async function toggleMealDone(slotId: string, dateIso: string): Promise<ToggleResult> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Не авторизовано" }

  const userId = session.user.id
  const date = new Date(dateIso)

  const log = await getOrCreateMealLog(userId, date, slotId)
  const updated = await db.mealLog.update({
    where: { id: log.id },
    data: { done: !log.done },
  })

  revalidatePath("/today")
  return { success: true, done: updated.done }
}
