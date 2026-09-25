"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { api } from "@/lib/api-client"
import { getTranslations } from "@/lib/i18n"

const ROLE_EMOJI: Record<string, string> = {
  'Product Design': '🎨',
  'Product Management': '📊'
}

/**
 * Header chip showing the account's CURRENT role track, linking to /role (the
 * revisitable role-select page). Kept in sync with the session by re-reading
 * /auth/me on mount — after a switch the page refreshes, so this re-renders
 * with the new track.
 */
export function RoleChip() {
  const t = getTranslations()
  const [roleName, setRoleName] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setStatus('loading')
      try {
        const me = await api.getMe()
        if (cancelled) return
        if (!me.user.roleTrackId) {
          setRoleName(null)
          setStatus('ready')
          return
        }
        const { roles } = await api.getRoles()
        if (cancelled) return
        setRoleName(roles.find(role => role.id === me.user.roleTrackId)?.name ?? null)
        setStatus('ready')
      } catch {
        if (!cancelled) {
          setRoleName(null)
          setStatus('error')
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (status === 'loading') {
    return (
      <span
        aria-busy
        className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm text-muted-foreground"
      >
        <span className="animate-pulse">Role…</span>
      </span>
    )
  }

  if (status === 'error' || !roleName) {
    return (
      <Link
        href="/role"
        className="inline-flex items-center gap-2 rounded-full border border-destructive/40 px-3 py-1.5 text-sm hover:bg-muted transition-colors"
        title="Couldn't load role — pick again"
      >
        <span aria-hidden>⚠️</span>
        <span className="font-medium">Role unavailable · retry</span>
      </Link>
    )
  }

  return (
    <Link
      href="/role"
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
      title={t.nav.switchTrack}
    >
      <span aria-hidden>{ROLE_EMOJI[roleName] ?? '🧭'}</span>
      <span className="font-medium">
        {t.roles.byName[roleName as keyof typeof t.roles.byName]?.name ?? roleName}
      </span>
      <span aria-hidden className="text-muted-foreground">· {t.nav.switchTrack}</span>
    </Link>
  )
}