"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export type ProgressActionState = { error: string } | { success: true } | null

// ─── saveWeight ───────────────────────────────────────────────────────────────

const saveWeightSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Невірний формат дати"),
  kg: z.coerce.number().min(20, "Мінімум 20 кг").max(300, "Максимум 300 кг"),
})

export async function saveWeight(
  _prevState: ProgressActionState,
  formData: FormData,
): Promise<ProgressActionState> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Не авторизовано" }

  const parsed = saveWeightSchema.safeParse({
    date: formData.get("date"),
    kg: formData.get("kg"),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const day = new Date(`${parsed.data.date}T00:00:00.000Z`)

  await db.weightEntry.upsert({
    where: { userId_date: { userId: session.user.id, date: day } },
    create: { userId: session.user.id, date: day, kg: parsed.data.kg },
    update: { kg: parsed.data.kg },
  })

  revalidatePath("/progress")
  return { success: true }
}

// ─── saveMeasurements ─────────────────────────────────────────────────────────

const measurementsSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Невірний формат дати"),
    bicep: z.coerce.number().min(10).max(200).nullable(),
    chest: z.coerce.number().min(10).max(200).nullable(),
    thigh: z.coerce.number().min(10).max(200).nullable(),
    waist: z.coerce.number().min(10).max(200).nullable(),
  })
  .refine(
    (d) => d.bicep !== null || d.chest !== null || d.thigh !== null || d.waist !== null,
    { message: "Введіть хоча б один замір" },
  )

function parseOptionalCm(val: FormDataEntryValue | null): number | null {
  if (!val || val === "") return null
  const n = Number(val)
  return isNaN(n) ? null : n
}

export async function saveMeasurements(
  _prevState: ProgressActionState,
  formData: FormData,
): Promise<ProgressActionState> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Не авторизовано" }

  const parsed = measurementsSchema.safeParse({
    date: formData.get("date"),
    bicep: parseOptionalCm(formData.get("bicep")),
    chest: parseOptionalCm(formData.get("chest")),
    thigh: parseOptionalCm(formData.get("thigh")),
    waist: parseOptionalCm(formData.get("waist")),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { date, ...fields } = parsed.data
  const day = new Date(`${date}T00:00:00.000Z`)

  await db.bodyMeasurement.upsert({
    where: { userId_date: { userId: session.user.id, date: day } },
    create: { userId: session.user.id, date: day, ...fields },
    update: fields,
  })

  revalidatePath("/progress")
  return { success: true }
}
