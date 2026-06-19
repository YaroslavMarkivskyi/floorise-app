import { auth } from "@/lib/auth"
import { signOutUser } from "@/actions/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { routes } from "@/lib/routes"

const navItems = [
  { href: routes.today, label: "Сьогодні" },
  { href: routes.progress, label: "Прогрес" },
  { href: routes.purchase, label: "Закупи" },
  { href: routes.settings, label: "Налаштування" },
] as const

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect(routes.login)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:flex md:w-56 md:flex-col border-r bg-white z-10">
        <div className="flex flex-col flex-1 p-4 gap-1">
          <p className="text-xs text-gray-400 truncate px-3 py-2 mb-2">
            {session.user.email}
          </p>

          <nav className="flex flex-col gap-0.5">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <form action={signOutUser} className="mt-auto">
            <button
              type="submit"
              className="w-full text-left rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              Вийти
            </button>
          </form>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="md:pl-56 min-h-screen">
        <div className="p-4 pb-24 md:pb-6">{children}</div>
      </main>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t z-10">
        <div className="flex h-16">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center justify-center text-xs text-gray-500 hover:text-black transition-colors gap-0.5"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}
