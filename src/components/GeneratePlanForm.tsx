"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { generateDraftPlan, type PlanActionState } from "@/actions/plan"

function SubmitButton({ hasExisting }: { hasExisting: boolean }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 flex items-center gap-2"
    >
      {pending ? (
        <>
          <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block" />
          Генерується…
        </>
      ) : hasExisting ? (
        "↻ Перегенерувати план"
      ) : (
        "✦ Згенерувати план"
      )}
    </button>
  )
}

interface Props {
  hasExisting: boolean
  weekStartIso: string
}

export function GeneratePlanForm({ hasExisting, weekStartIso }: Props) {
  const [state, action] = useActionState<PlanActionState, FormData>(generateDraftPlan, null)

  return (
    <form action={action} className="rounded-2xl border border-zinc-200 bg-white p-4 flex flex-col gap-3">
      <input type="hidden" name="weekStart" value={weekStartIso} />

      <div className="flex flex-col gap-1">
        <label htmlFor="userNotes" className="text-xs font-semibold text-zinc-500">
          Побажання на тиждень
        </label>
        <textarea
          id="userNotes"
          name="userNotes"
          rows={2}
          placeholder="Більше риби, уникати молочного у вечері…"
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 resize-none focus:border-zinc-400 focus:outline-none"
        />
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <SubmitButton hasExisting={hasExisting} />
        <p className="text-xs text-zinc-400">
          Займає ~30 с · автогенерація щонеділі вночі
        </p>
      </div>

      {state && "error" in state && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm font-medium text-red-700">{state.error}</p>
        </div>
      )}
      {state && "success" in state && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
          <p className="text-sm font-medium text-emerald-700">План згенеровано ✓</p>
        </div>
      )}
    </form>
  )
}
