"use client"

import { useState, useCallback } from "react"
import { PlanDishDrawer } from "@/components/PlanDishDrawer"
import { PlanRegenButton } from "@/components/PlanRegenButton"

export interface PlanDishCell {
  planId: string
  slotId: string
  dayOfWeek: number
  name: string
  kcal: number
  proteins: number | null
  fats: number | null
  carbs: number | null
  cookTime: number | null
  portionWeight: number | null
  ingredients: string[]
  steps: string[]
}

export interface PlanSlotRow {
  id: string
  name: string
  time: string
  days: (PlanDishCell | null)[]
}

interface Props {
  rows: PlanSlotRow[]
  isApproved: boolean
  isCurrentWeek: boolean
  todayDow: number
  weekDates: string[]
}

const DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"]

function MacroPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-semibold leading-none ${color}`}>
      <span className="opacity-50">{label}</span>{value}г
    </span>
  )
}

export function PlanTable({ rows, isApproved, isCurrentWeek, todayDow, weekDates }: Props) {
  const [selected, setSelected] = useState<PlanDishCell | null>(null)
  const close = useCallback(() => setSelected(null), [])

  function openDish(dish: PlanDishCell) {
    setSelected(dish)
  }

  // Daily totals per dayOfWeek column
  const totals = Array.from({ length: 7 }, (_, dow) => {
    let kcal = 0, proteins = 0, fats = 0, carbs = 0, hasMacros = false
    for (const row of rows) {
      const d = row.days[dow]
      if (!d) continue
      kcal += d.kcal
      if (d.proteins != null) { proteins += d.proteins; hasMacros = true }
      if (d.fats != null) { fats += d.fats; hasMacros = true }
      if (d.carbs != null) { carbs += d.carbs; hasMacros = true }
    }
    return { kcal, proteins, fats, carbs, hasMacros }
  })

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-xs">
          {/* ── Column headers ─────────────────────────────────── */}
          <thead>
            <tr>
              <th className="w-[80px] border-b border-zinc-100 bg-zinc-50/80 px-3 py-3 text-left" />
              {DAY_LABELS.map((label, dow) => {
                const isToday = isCurrentWeek && dow === todayDow
                return (
                  <th
                    key={dow}
                    className={`border-b px-2 py-3 text-center ${
                      isToday ? "border-emerald-200 bg-emerald-50" : "border-zinc-100 bg-zinc-50/80"
                    }`}
                  >
                    <p className={`text-xs font-bold ${isToday ? "text-emerald-700" : "text-zinc-600"}`}>
                      {label}
                    </p>
                    <p className={`text-[10px] font-normal mt-0.5 ${isToday ? "text-emerald-400" : "text-zinc-400"}`}>
                      {weekDates[dow]}
                    </p>
                  </th>
                )
              })}
            </tr>
          </thead>

          {/* ── Dish rows ──────────────────────────────────────── */}
          <tbody>
            {rows.map((row, si) => (
              <tr key={row.id} className={si < rows.length - 1 ? "border-b border-zinc-100" : ""}>
                {/* Slot label */}
                <td className="border-r border-zinc-100 bg-zinc-50/60 px-3 py-3 align-middle">
                  <p className="text-xs font-bold text-zinc-700 leading-tight">{row.name}</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">{row.time}</p>
                </td>

                {/* Dish cells */}
                {Array.from({ length: 7 }, (_, dow) => {
                  const dish = row.days[dow]
                  const isToday = isCurrentWeek && dow === todayDow
                  return (
                    <td
                      key={dow}
                      className={`px-1.5 py-1.5 align-top ${isToday ? "bg-emerald-50/30" : ""}`}
                    >
                      {dish ? (
                        <div className="group relative rounded-lg p-2 transition-all hover:bg-white hover:shadow-md hover:ring-1 hover:ring-zinc-200">
                          {/* Name */}
                          <button onClick={() => openDish(dish)} className="w-full text-left">
                            <p className="text-[11px] font-semibold leading-tight text-zinc-800 group-hover:text-emerald-700 transition-colors line-clamp-2">
                              {dish.name}
                            </p>
                          </button>

                          {/* kcal */}
                          <p className="mt-1 text-xs font-bold text-zinc-700">
                            {dish.kcal} <span className="text-[10px] font-normal text-zinc-400">ккал</span>
                          </p>

                          {/* Macros */}
                          {(dish.proteins != null || dish.fats != null || dish.carbs != null) && (
                            <div className="mt-1 flex flex-wrap gap-0.5">
                              {dish.proteins != null && (
                                <MacroPill label="Б" value={dish.proteins} color="bg-blue-50 text-blue-700" />
                              )}
                              {dish.fats != null && (
                                <MacroPill label="Ж" value={dish.fats} color="bg-amber-50 text-amber-700" />
                              )}
                              {dish.carbs != null && (
                                <MacroPill label="В" value={dish.carbs} color="bg-violet-50 text-violet-700" />
                              )}
                            </div>
                          )}

                          {/* Regen — on hover */}
                          <div className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <PlanRegenButton
                              planId={dish.planId}
                              slotId={dish.slotId}
                              dayOfWeek={dow}
                              isApproved={isApproved}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center py-4">
                          <span className="text-[10px] text-zinc-300">—</span>
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>

          {/* ── Daily totals row ───────────────────────────────── */}
          <tfoot>
            <tr className="border-t-2 border-zinc-200 bg-zinc-50/80">
              <td className="border-r border-zinc-200 px-3 py-3 align-middle">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  За день
                </p>
              </td>
              {totals.map((t, dow) => {
                const isToday = isCurrentWeek && dow === todayDow
                return (
                  <td
                    key={dow}
                    className={`px-2 py-3 text-center align-middle ${isToday ? "bg-emerald-50/40" : ""}`}
                  >
                    <p className={`text-sm font-bold ${isToday ? "text-emerald-700" : "text-zinc-800"}`}>
                      {t.kcal}
                      <span className="text-[10px] font-normal text-zinc-400 ml-0.5">ккал</span>
                    </p>
                    {t.hasMacros && (
                      <div className="mt-1 flex justify-center flex-wrap gap-0.5">
                        <MacroPill label="Б" value={t.proteins} color="bg-blue-50 text-blue-700" />
                        <MacroPill label="Ж" value={t.fats} color="bg-amber-50 text-amber-700" />
                        <MacroPill label="В" value={t.carbs} color="bg-violet-50 text-violet-700" />
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      <PlanDishDrawer dish={selected} onClose={close} />
    </>
  )
}
