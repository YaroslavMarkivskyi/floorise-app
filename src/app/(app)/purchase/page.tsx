import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { routes } from "@/lib/routes"
import { getOrCreateActiveList, finishTrip } from "@/actions/purchase"
import { getPreviousList, getListHistory } from "@/lib/purchase"
import { CheckboxItem } from "@/components/CheckboxItem"
import type { ShoppingItem } from "@/generated/prisma/client"

function fmtDate(date: Date): string {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date)
}

function groupByCategory(items: ShoppingItem[]): [string, ShoppingItem[]][] {
  const map = new Map<string, ShoppingItem[]>()
  for (const item of items) {
    const cat = item.category ?? "Інше"
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(item)
  }
  return Array.from(map.entries())
}

export default async function PurchasePage() {
  const session = await auth()
  if (!session?.user?.id) redirect(routes.login)
  const userId = session.user.id

  const [activeList, prevList, history] = await Promise.all([
    getOrCreateActiveList(userId),
    getPreviousList(userId),
    getListHistory(userId),
  ])

  const checkedCount = activeList.items.filter((i) => i.checked).length
  const totalCount = activeList.items.length
  const groups = groupByCategory(activeList.items)

  return (
    <div className="mx-auto max-w-lg space-y-8 px-4 py-5 pb-24 md:pb-5">
      {/* ─── Active list ─────────────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-zinc-900">Список покупок</h1>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-semibold text-zinc-600">
            {checkedCount} / {totalCount} куплено
          </span>
        </div>

        <div className="space-y-5">
          {groups.map(([category, items]) => (
            <div key={category}>
              <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                {category}
              </h2>
              <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white px-4">
                {items.map((item) => (
                  <CheckboxItem
                    key={item.id}
                    itemId={item.id}
                    name={item.name}
                    initialChecked={item.checked}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <form action={finishTrip} className="mt-6">
          <button
            type="submit"
            className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700"
          >
            Завершити похід та почати новий
          </button>
        </form>
      </section>

      {/* ─── Previous list ───────────────────────────────────────── */}
      {prevList && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Минулого разу
          </h2>
          <div className="rounded-xl border border-zinc-200 bg-white">
            {groupByCategory(prevList.items).map(([category, items], gi) => (
              <div key={category} className={gi > 0 ? "border-t border-zinc-100" : ""}>
                <p className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  {category}
                </p>
                <ul className="px-4 pb-2">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className={`py-1.5 text-sm ${
                        item.checked ? "text-zinc-400 line-through" : "text-zinc-600"
                      }`}
                    >
                      {item.name}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {prevList.closedAt && (
            <p className="mt-1.5 text-right text-xs text-zinc-400">
              Закрито {fmtDate(prevList.closedAt)}
            </p>
          )}
        </section>
      )}

      {/* ─── History ─────────────────────────────────────────────── */}
      {history.length > 0 && (
        <section>
          <details className="group">
            <summary className="cursor-pointer list-none">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                  Історія походів
                </h2>
                <span className="text-xs text-zinc-400 group-open:hidden">▸</span>
                <span className="hidden text-xs text-zinc-400 group-open:inline">▾</span>
              </div>
            </summary>
            <div className="mt-3 space-y-2">
              {history.map((list) => {
                const bought = list.items.filter((i) => i.checked).length
                return (
                  <div
                    key={list.id}
                    className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">
                        {fmtDate(list.createdAt)}
                      </p>
                      {list.closedAt && (
                        <p className="text-xs text-zinc-400">
                          Закрито {fmtDate(list.closedAt)}
                        </p>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-zinc-600">
                      {bought} / {list.items.length}
                    </span>
                  </div>
                )
              })}
            </div>
          </details>
        </section>
      )}
    </div>
  )
}
