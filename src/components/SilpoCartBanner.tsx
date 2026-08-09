"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

interface Props {
  status: string // idle | building | ready | failed
  checkoutUrl: string | null
}

/**
 * Renders the Silpo cart build state and, while "building", polls the server
 * every 5s via router.refresh() so the checkout link appears once the
 * background job finishes — no dedicated polling API needed at this scale.
 */
export function SilpoCartBanner({ status, checkoutUrl }: Props) {
  const router = useRouter()

  useEffect(() => {
    if (status !== "building") return
    const id = setInterval(() => router.refresh(), 5000)
    return () => clearInterval(id)
  }, [status, router])

  if (status === "building") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
        <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        <p className="text-sm font-medium text-emerald-700">
          Кошик Сільпо будується… Список оновиться автоматично.
        </p>
      </div>
    )
  }

  if (status === "failed") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50/60 px-4 py-3">
        <p className="text-sm font-medium text-red-700">
          Не вдалося побудувати кошик Сільпо. Нижче — звичайний список покупок.
        </p>
      </div>
    )
  }

  if (status === "ready" && checkoutUrl) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
        <p className="text-sm font-medium text-emerald-700">Кошик Сільпо готовий.</p>
        <a
          href={checkoutUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 whitespace-nowrap"
        >
          Оформити в Сільпо ↗
        </a>
      </div>
    )
  }

  return null
}
