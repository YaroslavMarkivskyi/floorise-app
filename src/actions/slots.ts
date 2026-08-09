"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { DIETARY_RESTRICTION_VALUES } from "@/lib/dietary-filters"

export type SlotActionState = { error: string } | { success: true } | null

// ─── updateSlot ───────────────────────────────────────────────────────────────

const updateSlotSchema = z.object({
  name: z.string().min(1, "Назва обов'язкова"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Формат часу: ГГ:ХХ"),
  targetKcal: z.coerce
    .number()
    .int()
    .min(100, "Мінімум 100 ккал")
    .max(2000, "Максимум 2000 ккал"),
  active: z.coerce.boolean(),
})

export async function updateSlot(
  id: string,
  _prevState: SlotActionState,
  formData: FormData,
): Promise<SlotActionState> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Не авторизовано" }

  const parsed = updateSlotSchema.safeParse({
    name: formData.get("name"),
    time: formData.get("time"),
    targetKcal: formData.get("targetKcal"),
    active: formData.get("active") === "on",
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const slot = await db.mealSlot.findUnique({ where: { id }, select: { userId: true } })
  if (!slot || slot.userId !== session.user.id) return { error: "Слот не знайдено" }

  await db.mealSlot.update({ where: { id }, data: parsed.data })

  revalidatePath("/today")
  revalidatePath("/settings")
  return { success: true }
}

// ─── reorderSlots ─────────────────────────────────────────────────────────────

export async function reorderSlots(ids: string[]): Promise<{ error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Не авторизовано" }
  const userId = session.user.id

  const slots = await db.mealSlot.findMany({
    where: { id: { in: ids }, userId },
    select: { id: true },
  })
  if (slots.length !== ids.length) return { error: "Деякі слоти не знайдено" }

  await Promise.all(
    ids.map((id, i) => db.mealSlot.update({ where: { id }, data: { order: i + 1 } })),
  )

  revalidatePath("/today")
  revalidatePath("/settings")
  return {}
}

// ─── updateProfile ────────────────────────────────────────────────────────────

const updateProfileSchema = z
  .object({
    kcalFloor: z.coerce
      .number()
      .int()
      .min(1000, "Мінімум 1000 ккал")
      .max(4000, "Максимум 4000 ккал"),
    kcalTarget: z.coerce
      .number()
      .int()
      .min(1000, "Мінімум 1000 ккал")
      .max(4000, "Максимум 4000 ккал"),
    timezone: z.string().min(1, "Оберіть часовий пояс"),
    dietaryRestrictions: z
      .array(z.string())
      .default([])
      // Keep only known flags; silently drop anything unexpected.
      .transform((vals) =>
        vals.filter((v) => (DIETARY_RESTRICTION_VALUES as readonly string[]).includes(v)),
      ),
    dietaryNotes: z
      .string()
      .trim()
      .max(500, "Максимум 500 символів")
      .optional()
      .transform((v) => (v ? v : null)),
  })
  .refine((d) => d.kcalTarget > d.kcalFloor, {
    message: "Ціль має бути більше мінімуму",
    path: ["kcalTarget"],
  })

export async function updateProfile(
  _prevState: SlotActionState,
  formData: FormData,
): Promise<SlotActionState> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Не авторизовано" }

  const parsed = updateProfileSchema.safeParse({
    kcalFloor: formData.get("kcalFloor"),
    kcalTarget: formData.get("kcalTarget"),
    timezone: formData.get("timezone"),
    dietaryRestrictions: formData.getAll("dietaryRestrictions"),
    dietaryNotes: formData.get("dietaryNotes") ?? undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  await db.profile.update({
    where: { userId: session.user.id },
    data: parsed.data,
  })

  revalidatePath("/today")
  revalidatePath("/settings")
  return { success: true }
}
