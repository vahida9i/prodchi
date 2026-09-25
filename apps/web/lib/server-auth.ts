import { cookies } from 'next/headers'

/**
 * Base URL for the SERVER-SIDE session lookup.
 *
 * This fetch runs inside the Next.js server, not the browser, so it needs a URL
 * that resolves from wherever that server runs. In Docker the container's own
 * localhost is not the API: NEXT_PUBLIC_API_URL is the browser-facing address
 * (http://localhost:4000), and pointing the in-container fetch at it makes every
 * gated layout bounce to /login. SERVER_API_URL carries the internal address
 * (http://api:4000/api/v1 under Compose); NEXT_PUBLIC_API_URL stays the fallback,
 * so nothing changes outside a container.
 */
const API_BASE =
  process.env.SERVER_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:4000/api/v1'

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
      cache: 'no-store',
      // A down API must not hang every layout gate; fall through to null
      // (which routes the visitor to /login) after 3s.
      signal: AbortSignal.timeout(3000)
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