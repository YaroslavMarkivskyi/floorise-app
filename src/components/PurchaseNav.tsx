"use client"

import { useRouter } from "next/navigation"

interface Props {
  weekStart: string // ISO "YYYY-MM-DD"
  isCurrentWeek: boolean
  hasPrev: boolean
  hasNext: boolean
}

export function PurchaseNav({ weekStart, isCurrentWeek, hasPrev, hasNext }: Props) {
  const router = useRouter()

  function navigate(offsetDays: number) {
    const d = new Date(`${weekStart}T00:00:00.000Z`)
    d.setUTCDate(d.getUTCDate() + offsetDays)
    const iso = d.toISOString().slice(0, 10)
    router.push(`/purchase?week=${iso}`)
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => navigate(-7)}
        disabled={!hasPrev}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-sm text-zinc-500 transition-colors hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-default"
        aria-label="Попередній тиждень"
      >
        ‹
      </button>

      {isCurrentWeek ? (
        <span className="min-w-[5rem] text-center text-xs font-medium text-zinc-400">Поточний</span>
      ) : (
        <button
          onClick={() => router.push("/purchase")}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-50 transition-colors"
        >
          Поточний
        </button>
      )}

      <button
        onClick={() => navigate(7)}
        disabled={!hasNext}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-sm text-zinc-500 transition-colors hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-default"
        aria-label="Наступний тиждень"
      >
        ›
      </button>
    </div>
  )
}
