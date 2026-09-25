import { redirect } from 'next/navigation'
import { getServerSessionUser } from '@/lib/server-auth'
import { PersianUserShell } from '@/components/user/PersianUserShell'

/**
 * Gate for every user-facing screen: authentication plus the one-time role
 * selection. Unauthenticated visitors go to /login, users without a role track go
 * to /onboarding (which lives outside this group so it cannot redirect-loop).
 */
export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerSessionUser()

  if (!user) {
    redirect('/login')
  }

  if (!user.roleTrackId) {
    redirect('/onboarding')
  }

  return <PersianUserShell>{children}</PersianUserShell>
}
