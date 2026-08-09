"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// Disconnect the current user's Silpo account by deleting the stored connection.
export async function disconnectSilpo(): Promise<void> {
  const session = await auth()
  if (!session?.user?.id) return

  await db.silpoConnection.deleteMany({ where: { userId: session.user.id } })

  revalidatePath("/settings")
}
