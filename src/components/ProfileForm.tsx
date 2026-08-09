"use client"

import { useActionState } from "react"
import { updateProfile } from "@/actions/slots"
import type { SlotActionState } from "@/actions/slots"
import { DIETARY_RESTRICTIONS } from "@/lib/dietary-filters"

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
  dietaryRestrictions: string[]
  dietaryNotes: string
}

export function ProfileForm({
  kcalFloor,
  kcalTarget,
  timezone,
  dietaryRestrictions,
  dietaryNotes,
}: Props) {
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

      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-zinc-600">Дієтичні обмеження</label>
        <p className="text-xs text-zinc-400">
          Впливають на добір страв із каталогу. Без жодної позначки — доступний повний каталог.
        </p>
        <div className="flex flex-col gap-2">
          {DIETARY_RESTRICTIONS.map((r) => (
            <label key={r.value} className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                name="dietaryRestrictions"
                type="checkbox"
                value={r.value}
                defaultChecked={dietaryRestrictions.includes(r.value)}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
              />
              {r.label}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-zinc-600">Додаткові побажання</label>
        <textarea
          name="dietaryNotes"
          defaultValue={dietaryNotes}
          rows={3}
          maxLength={500}
          placeholder="напр. не люблю гриби, менше гострого…"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
        />
        <p className="text-xs text-zinc-400">
          Вільний текст — не гарантовано враховується (лише як побажання для AI).
        </p>
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
