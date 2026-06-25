"use client"

import { useActionState, useRef, useEffect } from "react"
import { useFormStatus } from "react-dom"
import { addItem, type PurchaseActionState } from "@/actions/purchase"

function SubmitBtn() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
      aria-label="Додати"
    >
      {pending ? (
        <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
      ) : (
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 3a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H4a1 1 0 1 1 0-2h5V4a1 1 0 0 1 1-1z" />
        </svg>
      )}
    </button>
  )
}

export function AddItemForm({ weekStart }: { weekStart: string }) {
  const [state, action] = useActionState<PurchaseActionState, FormData>(addItem, null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (state && "success" in state && inputRef.current) {
      inputRef.current.value = ""
      inputRef.current.focus()
    }
  }, [state])

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="weekStart" value={weekStart} />
      <input
        ref={inputRef}
        name="name"
        type="text"
        placeholder="Додати продукт…"
        autoComplete="off"
        className="h-9 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
      />
      <SubmitBtn />
    </form>
  )
}
