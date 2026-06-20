"use client"

import { useEffect, useRef, useState } from "react"
import type { PlanDishCell } from "@/components/PlanTable"

interface Props {
  dish: PlanDishCell | null
  onClose: () => void
}

export function PlanDishDrawer({ dish, onClose }: Props) {
  const open = dish !== null
  const [ingredients, setIngredients] = useState<string[]>([])
  const [steps, setSteps] = useState<string[]>([])
  const [portionWeight, setPortionWeight] = useState<number | null>(dish?.portionWeight ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    if (!dish) { setIngredients([]); setSteps([]); setPortionWeight(null); setError(false); return }

    setPortionWeight(dish.portionWeight ?? null)

    if (dish.ingredients.length > 0) {
      setIngredients(dish.ingredients)
      setSteps(dish.steps)
      return
    }

    setLoading(true)
    setError(false)
    const url = `/api/nutrition/plan-recipe?planId=${dish.planId}&slotId=${dish.slotId}&dayOfWeek=${dish.dayOfWeek}`
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(true); return }
        setIngredients(data.ingredients ?? [])
        setSteps(data.steps ?? [])
        setPortionWeight(data.portionWeight ?? null)
        dish.ingredients = data.ingredients ?? []
        dish.steps = data.steps ?? []
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [dish, retryKey])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  if (!dish) return null

  const cookTimeLabel = dish.cookTime ? `${dish.cookTime} хв` : null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={dish.name}
        className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[90vh] flex-col rounded-t-3xl bg-white shadow-2xl animate-slide-up md:left-auto md:right-6 md:bottom-6 md:w-[420px] md:rounded-2xl md:max-h-[80vh]"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0 md:hidden">
          <div className="h-1 w-10 rounded-full bg-zinc-200" />
        </div>

        {/* Header */}
        <div className="relative shrink-0 overflow-hidden rounded-t-3xl md:rounded-t-2xl bg-gradient-to-br from-emerald-50 to-teal-50 px-5 pt-5 pb-5">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-zinc-400 shadow-sm hover:bg-white hover:text-zinc-700 transition-colors"
            aria-label="Закрити"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>

          <h2 className="pr-10 text-xl font-bold leading-snug text-zinc-900">{dish.name}</h2>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
              {dish.kcal} ккал{portionWeight ? ` / ~${portionWeight} г` : ""}
            </span>
            {cookTimeLabel && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-zinc-600 shadow-sm">
                ⏱ {cookTimeLabel}
              </span>
            )}
            {dish.proteins != null && dish.proteins > 0 && (
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">Б {dish.proteins}г</span>
            )}
            {dish.fats != null && dish.fats > 0 && (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Ж {dish.fats}г</span>
            )}
            {dish.carbs != null && dish.carbs > 0 && (
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">В {dish.carbs}г</span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <span className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-emerald-500 animate-spin" />
              <p className="text-sm text-zinc-400">Завантажую рецепт…</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
              <p className="text-sm text-zinc-400">Не вдалось завантажити рецепт.</p>
              <button
                onClick={() => setRetryKey((k) => k + 1)}
                className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 transition-colors"
              >
                Спробувати ще раз
              </button>
            </div>
          )}

          {!loading && !error && (
            <>
              <section className="px-5 pt-5 pb-4">
                <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400">
                  <span className="h-px flex-1 bg-zinc-100" />Інгредієнти<span className="h-px flex-1 bg-zinc-100" />
                </h3>
                <ul className="space-y-2">
                  {ingredients.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 rounded-xl bg-zinc-50 px-3 py-2.5">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-zinc-400 shadow-sm ring-1 ring-zinc-200">
                        {i + 1}
                      </span>
                      <span className="text-sm leading-snug text-zinc-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="px-5 pb-6">
                <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400">
                  <span className="h-px flex-1 bg-zinc-100" />Як готувати<span className="h-px flex-1 bg-zinc-100" />
                </h3>
                <ol className="space-y-3">
                  {steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white shadow-sm">
                        {i + 1}
                      </span>
                      <div className="flex-1 rounded-xl bg-zinc-50 px-3 py-2.5">
                        <p className="text-sm leading-relaxed text-zinc-700">{step}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            </>
          )}
        </div>
      </div>
    </>
  )
}
