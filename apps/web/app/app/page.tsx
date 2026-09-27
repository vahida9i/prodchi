import { redirect } from "next/navigation"
import { getServerSessionUser } from "@/lib/server-auth"

export default async function AppEntry() {
  const user = await getServerSessionUser()
  if (!user) redirect("/app/login")
  if (!user.roleTrackId) redirect("/app/onboarding")
  redirect("/app/home")
}
