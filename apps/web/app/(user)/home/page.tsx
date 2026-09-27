"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Flame, Star, Trophy, Zap } from "lucide-react"
import { api } from "@/lib/api-client"
import type { LevelOnPath, ProgressSummary, Leaderboard, DailyChallenge } from "@/lib/api-client"
import { PathMap } from "@/components/challenge/PathMap"
import { ProgressStat } from "@/components/user/ProgressStat"
import { Button } from "@/components/ui/button"
import { digits } from "@/lib/utils"

const roleLabel = (name: string | null) => {
  return name ? (({ "Product Design": "طراحی محصول", "Product Management": "مدیریت محصول", "Tech Lead": "تک لید" } as Record<string, string>)[name] ?? "نقش تخصصی فعال") : "تغییر نقش"
}

export default function HomePage() {
  const router = useRouter()
  const [levels, setLevels] = useState<LevelOnPath[]>([])
  const [progress, setProgress] = useState<ProgressSummary | null>(null)
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null)
  const [dailyChallenge, setDailyChallenge] = useState<DailyChallenge | null>(null)
  const [roleName, setRoleName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [levelsRes, progressRes, me, ranking, daily] = await Promise.all([api.getLevels(), api.getProgress(), api.getMe(), api.getLeaderboard(), api.getDailyChallenge().catch(() => null)])
        setLevels(levelsRes.levels)
        setProgress(progressRes)
        setLeaderboard(ranking)
        setDailyChallenge(daily)
        if (me.user.roleTrackId) {
          const { roles } = await api.getRoles()
          setRoleName(roles.find(role => role.id === me.user.roleTrackId)?.name ?? null)
        }
      } catch (err: any) {
        if (err?.status === 401) { router.push("/login"); return }
        setError("خطایی رخ داد. لطفاً دوباره تلاش کنید.")
      } finally { setLoading(false) }
    }
    fetchData()
  }, [router])

  const handleStartLevel = (level: LevelOnPath) => router.push(`/levels/${level.id}`)

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
          <Button type="button" variant="outline" className="touch-target shrink-0" onClick={() => router.push("/role")}>تغییر نقش</Button>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">هر روز یک تصمیم بهتر بگیر و مسیر مهارتت را جلو ببر.</p>
      </section>

      {progress && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ProgressStat label={"امتیاز"} value={progress.totalXp} icon={Zap} tone="green" />
        <ProgressStat label={"تداوم فعالیت"} value={progress.streak.currentStreak} icon={Flame} tone="gold" />
        <ProgressStat label={"مرحله"} value={progress.playerLevel} icon={Trophy} tone="blue" />
        <ProgressStat label={"ستاره‌ها"} value={progress.totalStars} icon={Star} tone="rose" />
      </div>}

      {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      {dailyChallenge && <section className="rounded-2xl border border-primary/25 bg-primary px-5 py-5 text-primary-foreground shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold opacity-85">چالش امروز {dailyChallenge.completed ? '· کامل شد' : ''}</p><h3 className="mt-2 text-lg font-extrabold leading-8">{dailyChallenge.title}</h3></div>{leaderboard?.userRank && <span className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">رتبهٔ هفته: {digits(leaderboard.userRank.rank)}</span>}</div><p className="mt-2 text-xs opacity-85">{dailyChallenge.difficulty === 'easy' ? 'آسان' : dailyChallenge.difficulty === 'hard' ? 'سخت' : 'متوسط'} · حدود {digits(dailyChallenge.estimatedMinutes)} دقیقه · {digits(dailyChallenge.bonusXp)} امتیاز روزانه</p><Button className="touch-target mt-4 w-full bg-white text-primary hover:bg-white/90" onClick={() => router.push('/daily')}>{dailyChallenge.completed ? 'دیدن نتیجهٔ امروز' : 'مشاهده و شروع چالش'}</Button></section>}

      {current && <section className="rounded-2xl border border-primary/20 bg-primary/[0.06] px-4 py-4"><p className="text-xs font-bold text-primary">قدم بعدی شما</p><div className="mt-1 flex items-center justify-between gap-3"><div><p className="font-bold">{current.title}</p><p className="mt-1 text-xs text-muted-foreground">مرحله {digits(current.number)} · {current.industry.name}</p></div><span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">از مسیر ادامه دهید</span></div></section>}

      <section className="space-y-4"><div><h2 className="text-xl font-extrabold">مسیر یادگیری و پیشرفت شما</h2><p className="mt-1 text-sm text-muted-foreground">سناریوهای واقعی را مرحله‌به‌مرحله حل کنید. هر تصمیم بر سرنوشت محصول تأثیر می‌گذارد.</p></div><PathMap levels={levels} startingId={null} onStart={handleStartLevel} onViewSummary={handleViewSummary} /></section>
    </div>
  )
}
