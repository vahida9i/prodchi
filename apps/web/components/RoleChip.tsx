"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { api } from "@/lib/api-client"
import { getTranslations } from "@/lib/i18n"
import { Briefcase, ChevronLeft, AlertCircle } from "lucide-react"

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
        <span className="animate-pulse">در حال بارگذاری نقش…</span>
      </span>
    )
  }

  if (status === 'error' || !roleName) {
    return (
      <Link
        href="/role"
        className="inline-flex items-center gap-2 rounded-full border border-destructive/40 px-3 py-1.5 text-sm hover:bg-muted transition-colors"
        title="بارگذاری نقش ناموفق بود؛ دوباره انتخاب کنید"
      >
        <AlertCircle size={16} aria-hidden />
        <span className="font-medium">انتخاب نقش</span>
        <ChevronLeft size={14} aria-hidden />
      </Link>
    )
  }

  return (
    <Link
      href="/role"
      className="touch-target inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm transition-colors hover:bg-muted"
      title={t.nav.switchTrack}
    >
      <Briefcase size={16} className="text-primary" aria-hidden />
      <span className="font-medium">
      {t.roles.byName[roleName as keyof typeof t.roles.byName]?.name ?? t.profile.roleLabel}
      </span>
      <ChevronLeft size={14} className="text-muted-foreground" aria-hidden />
    </Link>
  )
}
