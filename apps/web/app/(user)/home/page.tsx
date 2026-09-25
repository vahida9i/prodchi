"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Flame, Star, Trophy, Zap } from "lucide-react"
import { api } from "@/lib/api-client"
import type { LevelOnPath, ProgressSummary } from "@/lib/api-client"
import { PathMap } from "@/components/challenge/PathMap"
import { ProgressStat } from "@/components/user/ProgressStat"
import { Button } from "@/components/ui/button"
import { digits, getTranslations } from "@/lib/i18n"

const roleLabel = (name: string | null) => {
  const t = getTranslations()
  return name ? (t.roles.byName[name as keyof typeof t.roles.byName]?.name ?? t.profile.roleLabel) : t.nav.switchTrack
}

export default function HomePage() {
  const router = useRouter()
  const t = getTranslations()
  const [levels, setLevels] = useState<LevelOnPath[]>([])
  const [progress, setProgress] = useState<ProgressSummary | null>(null)
  const [roleName, setRoleName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [startingId, setStartingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [levelsRes, progressRes, me] = await Promise.all([api.getLevels(), api.getProgress(), api.getMe()])
        setLevels(levelsRes.levels)
        setProgress(progressRes)
        if (me.user.roleTrackId) {
          const { roles } = await api.getRoles()
          setRoleName(roles.find(role => role.id === me.user.roleTrackId)?.name ?? null)
        }
      } catch (err: any) {
        if (err?.status === 401) { router.push("/login"); return }
        setError(t.auth.errorGeneral)
      } finally { setLoading(false) }
    }
    fetchData()
  }, [router])

  const handleStartLevel = async (level: LevelOnPath) => {
    setStartingId(level.id)
    try {
      const res = await api.startLevel(level.id)
      router.push(`/sessions/${res.sessionId}`)
    } catch (err: any) {
      if (err?.status === 401) { router.push("/login"); return }
      setError(t.auth.errorGeneral)
    } finally { setStartingId(null) }
  }

  const handleViewSummary = (level: LevelOnPath) => {
    if (level.progress.lastSessionId) router.push(`/sessions/${level.progress.lastSessionId}/summary`)
  }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-9 w-9 animate-spin rounded-full border-4 border-primary/20 border-t-primary" /></div>

  const current = levels.find(level => level.progress.status === "unlocked")
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-sm text-muted-foreground">سلام! آماده‌ای؟</p><h2 className="mt-1 text-2xl font-extrabold tracking-tight">{roleLabel(roleName)}</h2></div>
          <Button type="button" variant="outline" className="touch-target shrink-0" onClick={() => router.push("/role")}>{t.nav.switchTrack}</Button>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">هر روز یک تصمیم بهتر بگیر و مسیر مهارتت را جلو ببر.</p>
      </section>

      {progress && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ProgressStat label={t.nav.xp} value={progress.totalXp} icon={Zap} tone="green" />
        <ProgressStat label={t.nav.streak} value={progress.streak.currentStreak} icon={Flame} tone="gold" />
        <ProgressStat label={t.nav.level} value={progress.playerLevel} icon={Trophy} tone="blue" />
        <ProgressStat label={t.nav.stars} value={progress.totalStars} icon={Star} tone="rose" />
      </div>}

      {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      {current && <section className="rounded-2xl border border-primary/20 bg-primary/[0.06] px-4 py-4"><p className="text-xs font-bold text-primary">قدم بعدی شما</p><div className="mt-1 flex items-center justify-between gap-3"><div><p className="font-bold">{current.title}</p><p className="mt-1 text-xs text-muted-foreground">مرحله {digits(current.number)} · {current.industry.name}</p></div><span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">از مسیر ادامه دهید</span></div></section>}

      <section className="space-y-4"><div><h2 className="text-xl font-extrabold">{t.path.title}</h2><p className="mt-1 text-sm text-muted-foreground">{t.path.subtitle}</p></div><PathMap levels={levels} startingId={startingId} onStart={handleStartLevel} onViewSummary={handleViewSummary} /></section>
    </div>
  )
}
