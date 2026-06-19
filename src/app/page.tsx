import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { routes } from "@/lib/routes"

export default async function RootPage() {
  const session = await auth()
  redirect(session ? routes.today : routes.login)
}
