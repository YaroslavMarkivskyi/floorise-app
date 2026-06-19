import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { routes } from "@/lib/routes"
import { getWeightHistory, getMeasurementHistory, getWeekOverview } from "@/lib/progress"
import { WeightForm } from "@/components/WeightForm"
import { MeasurementsForm } from "@/components/MeasurementsForm"

function utcToday(timezone: string): Date {
  const now = new Date()
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now).split("-")
  return new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])))
}

function fmtDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: timezone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date)
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null || delta === 0) return null
  const sign = delta > 0 ? "↑" : "↓"
  const abs = Math.abs(delta).toFixed(1)
  const color = delta > 0 ? "text-emerald-600" : "text-amber-600"
  return (
    <span className={`text-xs font-semibold ${color}`}>
      {sign}{abs}
    </span>
  )
}

export default async function ProgressPage() {
  const session = await auth()
  if (!session?.user?.id) redirect(routes.login)
  const userId = session.user.id

  const profile = await db.profile.findUnique({
    where: { userId },
    select: { kcalFloor: true, kcalTarget: true, timezone: true },
  })
  const timezone = profile?.timezone ?? "Europe/Kyiv"
  const kcalFloor = profile?.kcalFloor ?? 2000
  const kcalTarget = profile?.kcalTarget ?? 2800

  const today = utcToday(timezone)
  const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date())

  const [weightRows, measureRows, weekDays] = await Promise.all([
    getWeightHistory(userId),
    getMeasurementHistory(userId),
    getWeekOverview(userId, today, kcalFloor, kcalTarget),
  ])

  return (
    <div className="mx-auto max-w-lg space-y-8 px-4 py-5 pb-24 md:pb-5">
      <h1 className="text-xl font-bold text-zinc-900">Прогрес</h1>

      {/* ─── 7-day overview ─────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Останні 7 днів
        </h2>
        <div className="flex gap-2 justify-between">
          {weekDays.map((d) => (
            <div key={d.date.toISOString()} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  d.status === "strong"
                    ? "bg-emerald-500 text-white"
                    : d.status === "floor"
                      ? "bg-amber-400 text-white"
                      : "bg-zinc-200 text-zinc-400"
                }`}
              >
                {d.status === "strong" ? "✓" : d.status === "floor" ? "·" : ""}
              </div>
              <span className="text-[10px] font-medium text-zinc-400">{d.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-zinc-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Ціль виконана
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Мінімум
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" /> Відкрито
          </span>
        </div>
      </section>

      {/* ─── Weight ─────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">Вага</h2>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <WeightForm todayIso={todayIso} />
        </div>

        {weightRows.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-400 text-center">
            Ще немає записів. Зважуйся раз на тиждень.
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-400">Дата</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-zinc-400">Вага</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-zinc-400">Зміна</th>
                </tr>
              </thead>
              <tbody>
                {[...weightRows].reverse().map(({ entry, delta }) => (
                  <tr key={entry.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-3 text-zinc-600">{fmtDate(entry.date, timezone)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-zinc-900 tabular-nums">
                      {Number(entry.kg).toFixed(1)} кг
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DeltaBadge delta={delta} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ─── Body measurements ──────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Заміри тіла
        </h2>

        {/* Body SVG diagram */}
        <div className="mb-5 flex justify-center">
          <svg
            viewBox="0 0 120 220"
            className="h-48 w-auto"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Head */}
            <circle cx="60" cy="22" r="16" stroke="#d4d4d8" strokeWidth="2" />
            {/* Neck */}
            <line x1="52" y1="37" x2="52" y2="48" stroke="#d4d4d8" strokeWidth="2" />
            <line x1="68" y1="37" x2="68" y2="48" stroke="#d4d4d8" strokeWidth="2" />
            {/* Torso */}
            <rect x="38" y="48" width="44" height="60" rx="6" stroke="#d4d4d8" strokeWidth="2" />
            {/* Left arm */}
            <rect x="14" y="50" width="22" height="50" rx="8" stroke="#d4d4d8" strokeWidth="2" />
            {/* Right arm */}
            <rect x="84" y="50" width="22" height="50" rx="8" stroke="#d4d4d8" strokeWidth="2" />
            {/* Left leg */}
            <rect x="38" y="112" width="20" height="70" rx="8" stroke="#d4d4d8" strokeWidth="2" />
            {/* Right leg */}
            <rect x="62" y="112" width="20" height="70" rx="8" stroke="#d4d4d8" strokeWidth="2" />

            {/* Measurement dots + labels */}
            {/* 1 — Груди */}
            <circle cx="60" cy="68" r="5" fill="#3f3f46" />
            <text x="67" y="72" fontSize="8" fill="#3f3f46" fontWeight="600">1</text>
            {/* 2 — Талія */}
            <circle cx="60" cy="98" r="5" fill="#3f3f46" />
            <text x="67" y="102" fontSize="8" fill="#3f3f46" fontWeight="600">2</text>
            {/* 3 — Рука */}
            <circle cx="25" cy="72" r="5" fill="#3f3f46" />
            <text x="4" y="76" fontSize="8" fill="#3f3f46" fontWeight="600">3</text>
            {/* 4 — Стегно */}
            <circle cx="48" cy="135" r="5" fill="#3f3f46" />
            <text x="55" y="139" fontSize="8" fill="#3f3f46" fontWeight="600">4</text>
          </svg>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <MeasurementsForm todayIso={todayIso} />
        </div>

        {measureRows.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-400 text-center">
            Ще немає замірів.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {[...measureRows].reverse().map(({ entry, deltas }) => (
              <div
                key={entry.id}
                className="rounded-xl border border-zinc-200 bg-white p-4"
              >
                <p className="mb-2 text-xs font-semibold text-zinc-400">{fmtDate(entry.date, timezone)}</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                  {(
                    [
                      { key: "chest", label: "1 Груди" },
                      { key: "waist", label: "2 Талія" },
                      { key: "bicep", label: "3 Рука" },
                      { key: "thigh", label: "4 Стегно" },
                    ] as const
                  ).map(({ key, label }) => {
                    const val = entry[key]
                    if (val === null) return null
                    return (
                      <div key={key} className="flex items-center justify-between text-sm">
                        <span className="text-zinc-500">{label}</span>
                        <span className="flex items-center gap-1.5 font-semibold text-zinc-900">
                          {Number(val).toFixed(1)} см
                          <DeltaBadge delta={deltas[key]} />
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
