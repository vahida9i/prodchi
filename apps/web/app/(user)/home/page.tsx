"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api-client"
import type { LevelOnPath } from "@/lib/api-client"
import { PathMap } from "@/components/challenge/PathMap"
import { RoleChip } from "@/components/RoleChip"
import { getTranslations } from "@/lib/i18n"

/**
 * The candidate home: the one level path OF THE SELECTED TRACK. Pass a level by
 * reaching its END; every best call earns 10 XP, and replays can improve a best
 * run but never add XP. Levels are only playable in path order — the server
 * enforces the gate. The track header names the current role (with a switch
 * link to /role); an empty track explains itself instead of rendering a blank
 * path.
 */

// Keyed by name so a new seed role renders as soon as it exists.
const ROLE_DESCRIPTION: Record<string, string> = {
  'Product Design': 'User research, wireframing, visual design, usability testing...',
  'Product Management': 'Diagnosis, strategy, prioritization, roadmapping, measurement...'
}

const roleDescription = (name: string | null) =>
  (name && ROLE_DESCRIPTION[name]) ?? getTranslations().roles.defaultDescription

export default function HomePage() {
  const router = useRouter()
  const t = getTranslations()
  const [levels, setLevels] = useState<LevelOnPath[]>([])
  const [roleName, setRoleName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [startingId, setStartingId] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [levelsRes, me] = await Promise.all([api.getLevels(), api.getMe()])
        setLevels(levelsRes.levels)
        if (!me.user.roleTrackId) {
          setRoleName(null)
        } else {
          try {
            const { roles } = await api.getRoles()
            setRoleName(roles.find(role => role.id === me.user.roleTrackId)?.name ?? null)
          } catch {
            setRoleName(null)
          }
        }
      } catch (err: any) {
        if (err?.status === 401) {
          router.push("/login")
          return
        }
        console.error("Failed to load home:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [router])

  const handleStartLevel = async (level: LevelOnPath) => {
    setStartingId(level.id)
    try {
      const res = await api.startLevel(level.id)
      router.push(`/sessions/${res.sessionId}`)
    } catch (err: any) {
      if (err?.status === 401) {
        router.push("/login")
        return
      }
      // 403 = locked server-side; everything else is surfaced as-is.
      alert(err.message || t.auth.errorGeneral)
    } finally {
      setStartingId(null)
    }
  }

  /** The recap of a level's latest finished run — only a finished level has one. */
  const handleViewSummary = (level: LevelOnPath) => {
    const sessionId = level.progress.lastSessionId
    if (sessionId) router.push(`/sessions/${sessionId}/summary`)
  }

  const handleLogout = async () => {
    try {
      await api.logout()
    } catch {
      // Cookie clearing is best-effort; always land on the login screen.
    }
    router.push("/login")
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t.appName}</h1>
          <div className="flex items-center gap-2">
            <RoleChip />
            <Button variant="outline" size="sm" onClick={() => router.push("/profile")}>
              {t.nav.profile}
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push("/progress")}>
              {t.nav.progress}
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              {t.nav.signOut}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-10">
        <section className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.profile.roleLabel}</p>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold">
              {roleName ? (t.roles.byName[roleName as keyof typeof t.roles.byName]?.name ?? roleName) : t.nav.switchTrack}
            </h2>
            <Button variant="outline" size="sm" onClick={() => router.push("/role")}>
              {t.nav.switchTrack}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {roleName ? (t.roles.byName[roleName as keyof typeof t.roles.byName]?.description ?? roleDescription(roleName)) : t.roles.defaultDescription}
          </p>
        </section>
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">{t.path.title}</h2>
            <p className="text-sm text-muted-foreground">
              {t.path.subtitle}
            </p>
          </div>
          {levels.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.path.empty}</p>
          ) : (
          <PathMap
            levels={levels}
            startingId={startingId}
            onStart={handleStartLevel}
            onViewSummary={handleViewSummary}
          />
          )}
        </section>
      </main>
    </div>
  )
}