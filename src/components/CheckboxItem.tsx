"use client"

import { useOptimistic, useActionState } from "react"
import { toggleItem, deleteItem, type PurchaseActionState } from "@/actions/purchase"

interface Props {
  itemId: string
  name: string
  qty?: string | null
  initialChecked: boolean
}

export function CheckboxItem({ itemId, name, qty, initialChecked }: Props) {
  const [optimisticChecked, setOptimisticChecked] = useOptimistic(initialChecked)
  const [, toggleAction, togglePending] = useActionState<PurchaseActionState, FormData>(toggleItem, null)
  const [, deleteAction, deletePending] = useActionState<PurchaseActionState, FormData>(deleteItem, null)

  return (
    <div className="group flex items-center gap-3 py-2">
      <form
        action={async (fd) => {
          setOptimisticChecked(!optimisticChecked)
          await toggleAction(fd)
        }}
        className="flex flex-1 items-center gap-3"
      >
        <input type="hidden" name="itemId" value={itemId} />
        <button
          type="submit"
          disabled={togglePending}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors disabled:opacity-70"
          style={optimisticChecked
            ? { borderColor: "#10b981", backgroundColor: "#10b981" }
            : { borderColor: "#d1d5db", backgroundColor: "#ffffff" }}
        >
          {optimisticChecked && (
            <svg viewBox="0 0 10 8" className="h-3 w-3 fill-none stroke-white stroke-2">
              <polyline points="1,4 4,7 9,1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        <div className="flex flex-1 items-baseline gap-1.5 text-left">
          <span className={`text-sm transition-colors ${optimisticChecked ? "text-zinc-400 line-through" : "text-zinc-900"}`}>
            {name}
          </span>
          {qty && (
            <span className="text-xs text-zinc-400">{qty}</span>
          )}
        </div>
      </form>

      <form action={deleteAction} className="opacity-0 group-hover:opacity-100 transition-opacity">
        <input type="hidden" name="itemId" value={itemId} />
        <button
          type="submit"
          disabled={deletePending}
          className="flex h-6 w-6 items-center justify-center rounded-lg text-zinc-300 hover:bg-red-50 hover:text-red-400 transition-colors"
          aria-label="Видалити"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </form>
    </div>
  )
}
