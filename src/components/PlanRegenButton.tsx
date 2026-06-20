"use client"

import { useActionState, useRef, useState } from "react"
import { regenPlanSlot } from "@/actions/plan"
import type { PlanActionState } from "@/actions/plan"

interface Props {
  planId: string
  slotId: string
  dayOfWeek: number
  isApproved: boolean
}

export function PlanRegenButton({ planId, slotId, dayOfWeek, isApproved }: Props) {
  const [state, action, pending] = useActionState<PlanActionState, FormData>(regenPlanSlot, null)
  const [showNote, setShowNote] = useState(false)

  return (
    <div className="flex flex-col gap-1">
      <form action={action} className="flex flex-col gap-1">
        <input type="hidden" name="planId" value={planId} />
        <input type="hidden" name="slotId" value={slotId} />
        <input type="hidden" name="dayOfWeek" value={dayOfWeek} />

        {showNote && !isApproved && (
          <input
            name="userNote"
            autoFocus
            placeholder="Побажання..."
            className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-300"
          />
        )}

        <div className="flex items-center gap-1">
          <button
            type="submit"
            disabled={pending}
            title="Перегенерувати страву"
            className="flex items-center justify-center rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-40 transition-colors"
          >
            {pending ? (
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {!isApproved && (
            <button
              type="button"
              onClick={() => setShowNote((v) => !v)}
              title={showNote ? "Сховати побажання" : "Додати побажання"}
              className="flex items-center justify-center rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2.695 14.763l-1.262 3.154a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.885L17.5 5.5a2.121 2.121 0 0 0-3-3L3.58 13.42a4 4 0 0 0-.885 1.343z" />
              </svg>
            </button>
          )}
        </div>
      </form>

      {state && "error" in state && (
        <p className="text-[10px] text-red-500">{state.error}</p>
      )}
    </div>
  )
}
