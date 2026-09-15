import { redirect } from 'next/navigation'
import { getServerSessionUser } from '@/lib/server-auth'

/**
 * Admin gate. Non-admins never reach the admin screens, even by typing the URL:
 * the check runs on the server before any admin page renders (spec Section 2.1).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerSessionUser()

  if (!user) {
    redirect('/login')
  }

  if (user.role !== 'admin') {
    redirect('/home')
  }

  return <>{children}</>
}