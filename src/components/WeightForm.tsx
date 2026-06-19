"use client"

import { useActionState } from "react"
import { saveWeight } from "@/actions/progress"
import type { ProgressActionState } from "@/actions/progress"

export function WeightForm({ todayIso }: { todayIso: string }) {
  const [state, action, pending] = useActionState<ProgressActionState, FormData>(saveWeight, null)

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-zinc-600">Дата</label>
          <input
            name="date"
            type="date"
            defaultValue={todayIso}
            required
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-zinc-600">Вага (кг)</label>
          <input
            name="kg"
            type="number"
            step="0.1"
            min="20"
            max="300"
            placeholder="70.0"
            required
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
        </div>
      </div>

      {state && "error" in state && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      {state && "success" in state && (
        <p className="text-sm text-emerald-600">Збережено ✓</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
      >
        {pending ? "Збереження…" : "Зберегти вагу"}
      </button>
    </form>
  )
}
