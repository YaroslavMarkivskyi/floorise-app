"use client"

import { useActionState } from "react"
import Link from "next/link"
import { registerUser } from "@/actions/auth"
import { routes } from "@/lib/routes"

export default function RegisterPage() {
  const [state, action, pending] = useActionState(registerUser, null)

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-100 p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-md border border-zinc-200 p-8">
          <h1 className="text-2xl font-bold text-zinc-900 mb-8 text-center tracking-tight">
            Реєстрація
          </h1>

          <form action={action} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-semibold text-zinc-800">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-semibold text-zinc-800">
                Пароль
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Мінімум 8 символів"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirmPassword" className="text-sm font-semibold text-zinc-800">
                Підтвердження пароля
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Повтори пароль"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>

            {state && "error" in state && (
              <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="mt-1 w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            >
              {pending ? "Реєстрація..." : "Зареєструватись"}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-zinc-600">
          Вже маєш акаунт?{" "}
          <Link href={routes.login} className="font-semibold text-zinc-900 underline underline-offset-2">
            Увійти
          </Link>
        </p>
      </div>
    </main>
  )
}
