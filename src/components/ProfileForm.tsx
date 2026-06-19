"use client"

import { useActionState } from "react"
import { updateProfile } from "@/actions/slots"
import type { SlotActionState } from "@/actions/slots"

const TIMEZONES = [
  { value: "Europe/Kyiv",    label: "Київ (UTC+2/+3)" },
  { value: "Europe/Warsaw",  label: "Варшава (UTC+1/+2)" },
  { value: "Europe/Berlin",  label: "Берлін (UTC+1/+2)" },
  { value: "UTC",            label: "UTC" },
]

interface Props {
  kcalFloor: number
  kcalTarget: number
  timezone: string
}

export function ProfileForm({ kcalFloor, kcalTarget, timezone }: Props) {
  const [state, action, pending] = useActionState<SlotActionState, FormData>(updateProfile, null)

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-zinc-600">Мінімум ккал/день</label>
          <input
            name="kcalFloor"
            type="number"
            defaultValue={kcalFloor}
            min={1000}
            max={4000}
            required
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-zinc-600">Ціль ккал/день</label>
          <input
            name="kcalTarget"
            type="number"
            defaultValue={kcalTarget}
            min={1000}
            max={4000}
            required
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-zinc-600">Часовий пояс</label>
        <select
          name="timezone"
          defaultValue={timezone}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
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
        className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
      >
        {pending ? "Збереження…" : "Зберегти цілі"}
      </button>
    </form>
  )
}
