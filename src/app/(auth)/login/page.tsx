"use client"

import { useActionState } from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Link from "next/link"
import { loginUser } from "@/actions/auth"
import { routes } from "@/lib/routes"

function LoginForm() {
  const [state, action, pending] = useActionState(loginUser, null)
  const searchParams = useSearchParams()
  const registered = searchParams.get("registered") === "1"

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-100 p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-md border border-zinc-200 p-8">
          <h1 className="text-2xl font-bold text-zinc-900 mb-8 text-center tracking-tight">
            Вхід
          </h1>

          {registered && (
            <div className="mb-5 rounded-lg bg-green-50 border border-green-200 px-3 py-2.5 text-sm text-green-800 text-center">
              Акаунт створено, можеш увійти
            </div>
          )}

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
                autoComplete="current-password"
                placeholder="Введи пароль"
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
              {pending ? "Вхід..." : "Увійти"}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-zinc-600">
          Немає акаунту?{" "}
          <Link href={routes.register} className="font-semibold text-zinc-900 underline underline-offset-2">
            Зареєструватись
          </Link>
        </p>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
