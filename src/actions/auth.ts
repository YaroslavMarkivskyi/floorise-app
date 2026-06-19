"use server"

import { z } from "zod"
import bcrypt from "bcryptjs"
import { AuthError } from "next-auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { signIn, signOut } from "@/lib/auth"
import { routes } from "@/lib/routes"
import { seedUserDefaults } from "../../prisma/seed"

export type AuthActionState = { error: string } | { success: true } | null

// ─── Register ─────────────────────────────────────────────────────────────────

const registerSchema = z
  .object({
    email: z.string().email("Некоректний email"),
    password: z.string().min(8, "Пароль мінімум 8 символів"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Паролі не збігаються",
    path: ["confirmPassword"],
  })

export async function registerUser(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { email, password } = parsed.data

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) return { error: "Email вже використовується" }

  const passwordHash = await bcrypt.hash(password, 12)

  const user = await db.user.create({
    data: {
      email,
      passwordHash,
      profile: {
        create: {
          kcalFloor: 2000,
          kcalTarget: 2800,
          timezone: "Europe/Kyiv",
        },
      },
    },
  })

  await seedUserDefaults(user.id)

  redirect(`${routes.login}?registered=1`)
}

// ─── Login ────────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email("Некоректний email"),
  password: z.string().min(1, "Введіть пароль"),
})

export async function loginUser(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: routes.today,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Невірний email або пароль" }
    }
    throw error // re-throw redirect
  }

  return null
}

// ─── Sign out ─────────────────────────────────────────────────────────────────

export async function signOutUser(): Promise<void> {
  await signOut({ redirectTo: routes.login })
}
