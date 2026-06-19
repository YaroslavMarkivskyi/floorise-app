"use client"

import { useState } from "react"
import { toggleMealDone } from "@/actions/nutrition"

export interface SlotItem {
  slotId: string
  slotTime: string
  slotName: string
  dishName: string
  dishKcal: number
  initialDone: boolean
}

interface Props {
  slots: SlotItem[]
  dateIso: string
  kcalFloor: number
  kcalTarget: number
  dateLabel: string
  initialStreak: number
}

export function TodayView({ slots, dateIso, kcalFloor, kcalTarget, dateLabel, initialStreak }: Props) {
  const [doneMap, setDoneMap] = useState<Record<string, boolean>>(
    () => Object.fromEntries(slots.map((s) => [s.slotId, s.initialDone])),
  )

  async function handleToggle(slotId: string) {
    const next = !doneMap[slotId]
    setDoneMap((prev) => ({ ...prev, [slotId]: next }))

    const result = await toggleMealDone(slotId, dateIso)
    if ("error" in result) {
      // rollback on failure
      setDoneMap((prev) => ({ ...prev, [slotId]: !next }))
    }
  }

  const kcalDone = slots
    .filter((s) => doneMap[s.slotId])
    .reduce((sum, s) => sum + s.dishKcal, 0)

  const targetPct = Math.min(100, Math.round((kcalDone / kcalTarget) * 100))
  const floorMarkPct = Math.round((kcalFloor / kcalTarget) * 100)
  const streak = initialStreak

  const statusLabel =
    kcalDone >= kcalTarget
      ? "Сильний день ✓"
      : kcalDone >= kcalFloor
        ? "Мінімум виконано ✓"
        : "День відкрито"

  const statusColor =
    kcalDone >= kcalTarget
      ? "text-emerald-700"
      : kcalDone >= kcalFloor
        ? "text-blue-600"
        : "text-zinc-500"

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 py-5 pb-24 md:pb-5">
      {/* Date + streak */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-500 capitalize">{dateLabel}</p>
        {streak > 0 && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            🔥 {streak} {streak === 1 ? "день" : streak < 5 ? "дні" : "днів"}
          </span>
        )}
      </div>

      {/* Calorie progress card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-3xl font-bold text-zinc-900 tabular-nums">{kcalDone}</p>
            <p className="text-sm text-zinc-400">
              з <span className="font-semibold text-zinc-600">{kcalTarget}</span> ккал
            </p>
          </div>
          <p className={`text-sm font-semibold ${statusColor}`}>{statusLabel}</p>
        </div>

        <div className="relative h-3 rounded-full bg-zinc-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-zinc-800 transition-all duration-300"
            style={{ width: `${targetPct}%` }}
          />
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-blue-400 opacity-70"
            style={{ left: `${floorMarkPct}%` }}
          />
        </div>

        <div className="mt-2 flex justify-between text-xs text-zinc-400">
          <span>0</span>
          <span className="text-blue-500">мін {kcalFloor}</span>
          <span>{kcalTarget} ккал</span>
        </div>
      </div>

      {/* Meal slots */}
      <div className="space-y-3">
        {slots.map((s) => {
          const done = doneMap[s.slotId] ?? false
          return (
            <div
              key={s.slotId}
              className={`rounded-xl border p-4 transition-colors ${
                done ? "border-green-200 bg-green-50" : "border-zinc-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-zinc-400 tabular-nums">{s.slotTime}</p>
                  <p className="mt-0.5 text-sm font-semibold text-zinc-500">{s.slotName}</p>
                  <p className="mt-1 text-base font-semibold text-zinc-900 leading-snug">{s.dishName}</p>
                  <p className="mt-0.5 text-sm text-zinc-500">{s.dishKcal} ккал</p>
                </div>

                <button
                  onClick={() => handleToggle(s.slotId)}
                  className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    done
                      ? "bg-green-600 text-white hover:bg-green-700"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  }`}
                >
                  {done ? "✓ Зроблено" : "Відмітити"}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
