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

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  if (!open) return null

  const cookTimeLabel = dish.cookTime ? `${dish.cookTime} хв` : null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={dish.name}
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-white shadow-2xl max-h-[85vh] flex flex-col animate-slide-up"
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="h-1 w-10 rounded-full bg-zinc-300" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-2 pb-4 shrink-0 border-b border-zinc-100">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-zinc-900 leading-snug">{dish.name}</h2>
            <div className="mt-1 flex items-center gap-3 text-sm text-zinc-500">
              <span>{dish.kcal} ккал</span>
              {cookTimeLabel && (
                <>
                  <span className="text-zinc-300">·</span>
                  <span>⏱ {cookTimeLabel}</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
            aria-label="Закрити"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {/* Ingredients */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Інгредієнти
            </h3>
            <ul className="space-y-1.5">
              {dish.ingredients.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-zinc-700">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* Steps */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Як готувати
            </h3>
            <ol className="space-y-3">
              {dish.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-zinc-700">
                  <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-500">
                    {i + 1}
                  </span>
                  <span className="pt-0.5 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* Bottom spacing for mobile safe area */}
          <div className="h-4" />
        </div>
      </div>
    </>
  )
}
