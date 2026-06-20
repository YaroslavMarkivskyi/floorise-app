"use client"

import { useEffect, useRef } from "react"
import type { DishRecipe } from "@/types"

interface Props {
  dish: DishRecipe | null
  onClose: () => void
}

export function RecipeDrawer({ dish, onClose }: Props) {
  const open = dish !== null
  const drawerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={dish.name}
        className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[90vh] flex-col rounded-t-3xl bg-white shadow-2xl animate-slide-up md:left-auto md:right-6 md:bottom-6 md:w-[420px] md:rounded-2xl md:max-h-[80vh]"
      >
        {/* Handle (mobile only) */}
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

          <h2 className="pr-10 text-xl font-bold leading-snug text-zinc-900">
            {dish.name}
          </h2>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5z" />
              </svg>
              {dish.kcal} ккал
            </span>
            {dish.cookTime != null && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-zinc-600 shadow-sm">
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
                </svg>
                {dish.cookTime} хв
              </span>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Ingredients */}
          <section className="px-5 pt-5 pb-4">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400">
              <span className="h-px flex-1 bg-zinc-100" />
              Інгредієнти
              <span className="h-px flex-1 bg-zinc-100" />
            </h3>
            <ul className="space-y-2">
              {dish.ingredients.map((item, i) => (
                <li key={i} className="flex items-start gap-3 rounded-xl bg-zinc-50 px-3 py-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-zinc-400 shadow-sm ring-1 ring-zinc-200">
                    {i + 1}
                  </span>
                  <span className="text-sm leading-snug text-zinc-700">{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Steps */}
          <section className="px-5 pb-6">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400">
              <span className="h-px flex-1 bg-zinc-100" />
              Як готувати
              <span className="h-px flex-1 bg-zinc-100" />
            </h3>
            <ol className="space-y-3">
              {dish.steps.map((step, i) => (
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
        </div>
      </div>
    </>
  )
}
