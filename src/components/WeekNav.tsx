"use client"

import { useRouter } from "next/navigation"

interface Props {
  weekStart: string // ISO date "YYYY-MM-DD"
  isCurrentWeek: boolean
}

export function WeekNav({ weekStart, isCurrentWeek }: Props) {
  const router = useRouter()

  function navigate(offsetDays: number) {
    const d = new Date(`${weekStart}T00:00:00.000Z`)
    d.setUTCDate(d.getUTCDate() + offsetDays)
    const iso = d.toISOString().slice(0, 10)
    router.push(`/plan?week=${iso}`)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => navigate(-7)}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-sm text-zinc-500 hover:bg-zinc-50 transition-colors"
        aria-label="Попередній тиждень"
      >
        ‹
      </button>

      {!isCurrentWeek && (
        <button
          onClick={() => router.push("/plan")}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-50 transition-colors"
        >
          Сьогодні
        </button>
      )}

      <button
        onClick={() => navigate(7)}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-sm text-zinc-500 hover:bg-zinc-50 transition-colors"
        aria-label="Наступний тиждень"
      >
        ›
      </button>
    </div>
  )
}
