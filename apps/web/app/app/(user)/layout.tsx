import { redirect } from 'next/navigation'
import { getServerSessionUser } from '@/lib/server-auth'
import { PersianUserShell } from '@/components/user/PersianUserShell'

/**
 * Gate for every user-facing screen: authentication plus the one-time role
 * selection. Unauthenticated visitors go to /app/login, users without a role
 * track go to /app/onboarding (outside this group to avoid a redirect loop).
 */
export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerSessionUser()

  if (!user) {
    redirect('/app/login')
  }

  if (!user.roleTrackId) {
    redirect('/app/onboarding')
  }

  return <PersianUserShell>{children}</PersianUserShell>
}
