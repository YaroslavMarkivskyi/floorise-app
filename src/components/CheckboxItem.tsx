"use client"

import { useOptimistic, useActionState } from "react"
import { toggleItem } from "@/actions/purchase"
import type { PurchaseActionState } from "@/actions/purchase"

interface Props {
  itemId: string
  name: string
  initialChecked: boolean
}

export function CheckboxItem({ itemId, name, initialChecked }: Props) {
  const [optimisticChecked, setOptimisticChecked] = useOptimistic(initialChecked)
  const [, action, pending] = useActionState<PurchaseActionState, FormData>(toggleItem, null)

  return (
    <form
      action={async (formData) => {
        setOptimisticChecked(!optimisticChecked)
        await action(formData)
      }}
    >
      <input type="hidden" name="itemId" value={itemId} />
      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center gap-3 py-2 text-left disabled:opacity-70"
      >
        <span
          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
            optimisticChecked
              ? "border-emerald-500 bg-emerald-500"
              : "border-zinc-300 bg-white"
          }`}
        >
          {optimisticChecked && (
            <svg viewBox="0 0 10 8" className="h-3 w-3 fill-none stroke-white stroke-2">
              <polyline points="1,4 4,7 9,1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span
          className={`text-sm transition-colors ${
            optimisticChecked ? "text-zinc-400 line-through" : "text-zinc-900"
          }`}
        >
          {name}
        </span>
      </button>
    </form>
  )
}
