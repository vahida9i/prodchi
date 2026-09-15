import { cookies } from 'next/headers'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'

export interface SessionUser {
  id: string
  email: string
  role: string
  roleTrackId: string | null
  cohortId: string | null
}

/**
 * Resolves the current session user on the server by forwarding the session cookie
 * to the API. Used by the route-group layouts so role gating happens server-side
 * (spec Section 2.1: "role check enforced server-side, not just hidden in the UI")
 * instead of relying on client-side redirects.
 */
export async function getServerSessionUser(): Promise<SessionUser | null> {
  const cookieHeader = cookies().toString()
  if (!cookieHeader) {
    return null
  }

  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store'
    })

    if (!response.ok) {
      return null
    }

    const data = (await response.json()) as { user: SessionUser }
    return data.user
  } catch {
    return null
  }
}