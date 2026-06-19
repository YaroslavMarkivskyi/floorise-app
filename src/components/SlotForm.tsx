"use client"

import { useActionState } from "react"
import { updateSlot } from "@/actions/slots"
import type { SlotActionState } from "@/actions/slots"

interface Props {
  slot: {
    id: string
    name: string
    time: string
    targetKcal: number
    active: boolean
  }
}

const TIMEZONES = [
  { value: "Europe/Kyiv",    label: "Київ (UTC+2/+3)" },
  { value: "Europe/Warsaw",  label: "Варшава (UTC+1/+2)" },
  { value: "Europe/Berlin",  label: "Берлін (UTC+1/+2)" },
  { value: "UTC",            label: "UTC" },
]

export { TIMEZONES }

export function SlotForm({ slot }: Props) {
  const boundAction = updateSlot.bind(null, slot.id)
  const [state, action, pending] = useActionState<SlotActionState, FormData>(boundAction, null)

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 flex flex-col gap-1">
          <label className="text-xs font-semibold text-zinc-600">Назва</label>
          <input
            name="name"
            defaultValue={slot.name}
            required
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-zinc-600">Час</label>
          <input
            name="time"
            type="time"
            defaultValue={slot.time}
            required
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-zinc-600">Ціль ккал</label>
          <input
            name="targetKcal"
            type="number"
            defaultValue={slot.targetKcal}
            min={100}
            max={2000}
            required
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer select-none">
          <input
            name="active"
            type="checkbox"
            defaultChecked={slot.active}
            className="h-4 w-4 rounded border-zinc-300 accent-zinc-900"
          />
          Активний
        </label>

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {pending ? "Збереження…" : "Зберегти"}
        </button>
      </div>

      {state && "error" in state && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      {state && "success" in state && (
        <p className="text-sm text-emerald-600">Збережено ✓</p>
      )}
    </form>
  )
}
