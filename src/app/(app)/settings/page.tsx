import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { routes } from "@/lib/routes"
import { ProfileForm } from "@/components/ProfileForm"
import { SlotForm } from "@/components/SlotForm"
import { disconnectSilpo } from "@/actions/silpo"

interface Props {
  searchParams: Promise<{ silpo?: string }>
}

export default async function SettingsPage({ searchParams }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect(routes.login)
  const userId = session.user.id

  const { silpo: silpoStatus } = await searchParams

  const [profile, slots, silpoConnection] = await Promise.all([
    db.profile.findUnique({
      where: { userId },
      select: {
        kcalFloor: true,
        kcalTarget: true,
        timezone: true,
        dietaryRestrictions: true,
        dietaryNotes: true,
      },
    }),
    db.mealSlot.findMany({
      where: { userId },
      orderBy: { order: "asc" },
      select: { id: true, name: true, time: true, targetKcal: true, active: true, order: true },
    }),
    db.silpoConnection.findUnique({
      where: { userId },
      select: { connectedAt: true },
    }),
  ])

  return (
    <div className="mx-auto max-w-lg space-y-8 px-4 py-5 pb-24 md:pb-5">
      <h1 className="text-xl font-bold text-zinc-900">Налаштування</h1>

      {/* ─── Nutrition goals ──────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Цілі харчування
        </h2>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <ProfileForm
            kcalFloor={profile?.kcalFloor ?? 2000}
            kcalTarget={profile?.kcalTarget ?? 2800}
            timezone={profile?.timezone ?? "Europe/Kyiv"}
            dietaryRestrictions={profile?.dietaryRestrictions ?? []}
            dietaryNotes={profile?.dietaryNotes ?? ""}
          />
        </div>
      </section>

      {/* ─── Silpo connection ─────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Сільпо
        </h2>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          {silpoStatus === "error" && (
            <p className="mb-3 text-sm text-red-600">
              Не вдалося підключити Сільпо. Спробуй ще раз.
            </p>
          )}
          {silpoConnection ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-sm font-semibold text-zinc-700">Підключено</span>
              </div>
              <p className="text-xs text-zinc-400">
                Затверджені плани формують реальний кошик Сільпо з посиланням на оформлення.
              </p>
              <form action={disconnectSilpo}>
                <button
                  type="submit"
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
                >
                  Відключити
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-zinc-600">
                Підключи акаунт Сільпо, щоб зі списку покупок автоматично збирався
                реальний кошик.
              </p>
              <a
                href="/api/silpo/connect"
                className="inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-700"
              >
                Підключити Сільпо
              </a>
            </div>
          )}
        </div>
      </section>

      {/* ─── Meal slots ───────────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Прийоми їжі
        </h2>
        <div className="space-y-4">
          {slots.length === 0 && (
            <p className="text-sm text-zinc-400">Слотів ще немає.</p>
          )}
          {slots.map((slot) => (
            <div key={slot.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-500">
                  {slot.order}
                </span>
                <span className="text-sm font-semibold text-zinc-700">{slot.name}</span>
                {!slot.active && (
                  <span className="ml-auto rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-400">
                    вимкнений
                  </span>
                )}
              </div>
              <SlotForm slot={slot} />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
