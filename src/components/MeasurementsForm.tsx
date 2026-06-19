"use client"

import { useActionState } from "react"
import { saveMeasurements } from "@/actions/progress"
import type { ProgressActionState } from "@/actions/progress"

const FIELDS = [
  { name: "chest",  label: "Груди (см)",  num: 1 },
  { name: "waist",  label: "Талія (см)",  num: 2 },
  { name: "bicep",  label: "Рука (см)",   num: 3 },
  { name: "thigh",  label: "Стегно (см)", num: 4 },
] as const

export function MeasurementsForm({ todayIso }: { todayIso: string }) {
  const [state, action, pending] = useActionState<ProgressActionState, FormData>(
    saveMeasurements,
    null,
  )

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-zinc-600">Дата</label>
        <input
          name="date"
          type="date"
          defaultValue={todayIso}
          required
          className="w-40 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map((f) => (
          <div key={f.name} className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-zinc-600">
              <span className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-bold text-zinc-600">
                {f.num}
              </span>
              {f.label}
            </label>
            <input
              name={f.name}
              type="number"
              step="0.1"
              min="10"
              max="200"
              placeholder="—"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
          </div>
        ))}
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
        {pending ? "Збереження…" : "Зберегти заміри"}
      </button>
    </form>
  )
}
