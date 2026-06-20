"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface Props {
  slotId: string
  date: string
  fromStock: boolean
}

type State = "idle" | "loading" | "error"

export function RegenButton({ slotId, date, fromStock }: Props) {
  const router = useRouter()
  const [state, setState] = useState<State>("idle")
  const [errorMsg, setErrorMsg] = useState("")

  async function handleClick() {
    setState("loading")
    setErrorMsg("")

    try {
      const url = `/api/nutrition/regen${fromStock ? "?fromStock=true" : ""}`
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId, date }),
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        const msg = data.error ?? "Помилка. Спробуй ще."
        setErrorMsg(msg)
        setState("error")
        setTimeout(() => setState("idle"), 3000)
        return
      }

      router.refresh()
      setState("idle")
    } catch {
      setErrorMsg("Помилка мережі. Спробуй ще.")
      setState("error")
      setTimeout(() => setState("idle"), 3000)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={state === "loading"}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 disabled:opacity-50"
      >
        {state === "loading" ? (
          <>
            <svg
              className="h-3.5 w-3.5 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            Підбираю...
          </>
        ) : (
          <>↻ Інша</>
        )}
      </button>
      {state === "error" && (
        <p className="text-right text-xs text-red-500">{errorMsg}</p>
      )}
    </div>
  )
}
