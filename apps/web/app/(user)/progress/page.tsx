"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Flame, Medal, Star, Trophy, Zap } from "lucide-react"
import { api } from "@/lib/api-client"
import type { ProgressSummary, BadgeInfo, Leaderboard } from "@/lib/api-client"
import { ProgressStat } from "@/components/user/ProgressStat"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { digits, fmt, getTranslations } from "@/lib/i18n"

export default function ProgressPage() {
  const router = useRouter(); const t = getTranslations()
  const [progress, setProgress] = useState<ProgressSummary | null>(null); const [badges, setBadges] = useState<BadgeInfo[]>([]); const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null)
  useEffect(() => { const load = async () => { try { const [p, b, l] = await Promise.all([api.getProgress(), api.getBadges(), api.getLeaderboard()]); setProgress(p); setBadges(b.badges); setLeaderboard(l) } catch (err: any) { if (err?.status === 401) { router.push("/login"); return }; setError(t.progress.loadError) } finally { setLoading(false) } }; load() }, [router])
  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-9 w-9 animate-spin rounded-full border-4 border-primary/20 border-t-primary" /></div>
  return <div className="space-y-6">
    <section><p className="text-sm text-muted-foreground">آمار مسیر شما</p><h1 className="mt-1 text-2xl font-extrabold">{t.progress.title}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{t.progress.subtitle}</p></section>
    {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
    {progress && <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><ProgressStat label={t.nav.xp} value={progress.totalXp} icon={Zap} /><ProgressStat label={t.nav.streak} value={progress.streak.currentStreak} icon={Flame} tone="gold" /><ProgressStat label={t.nav.level} value={progress.playerLevel} icon={Trophy} tone="blue" /><ProgressStat label={t.nav.stars} value={progress.totalStars} icon={Star} tone="rose" /></div>
      <Card className="border-amber-200 bg-amber-50"><CardContent className="flex items-center gap-3 py-4"><Flame className="shrink-0 text-orange-600" size={24} fill="currentColor" aria-hidden /><div><p className="font-bold text-amber-950">{fmt(t.progress.dayStreak, { n: digits(progress.streak.currentStreak) })}</p><p className="text-xs text-amber-900/75">{fmt(t.progress.longestLabel, { n: digits(progress.streak.longestStreak), unit: progress.streak.longestStreak === 1 ? t.progress.day : t.progress.days })}</p></div></CardContent></Card>
      <section className="space-y-3"><h2 className="text-lg font-extrabold">{t.progress.industriesTitle}</h2>{progress.industries.map(industry => { const percent = industry.levelsTotal ? Math.round(industry.levelsPassed / industry.levelsTotal * 100) : 0; return <Card key={industry.id}><CardContent className="space-y-3 py-4"><div className="flex items-center justify-between gap-3"><div><p className="font-bold">{industry.name}</p><p className="mt-1 text-xs text-muted-foreground">{fmt(t.progress.levelsPassedOf, { passed: digits(industry.levelsPassed), total: digits(industry.levelsTotal) })}</p></div><span className="text-sm font-bold text-amber-600">{digits(industry.stars)}★</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} /></div></CardContent></Card> })}</section>
      <section className="space-y-3"><h2 className="text-lg font-extrabold">{t.progress.leaderboardTitle}</h2><Card><CardContent className="space-y-3 py-4">{leaderboard?.leaderboard.length ? leaderboard.leaderboard.map(row => <div key={row.userId} className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-3 text-sm"><span className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-card font-bold">{digits(row.rank)}</span><span>{row.player}</span></span><span className="font-semibold">{fmt(t.progress.leaderboardRowXp, { xp: digits(row.weeklyXp) })}</span></div>) : <p className="text-sm text-muted-foreground">{t.progress.leaderboardEmpty}</p>}{leaderboard?.userRank && <p className="border-t pt-3 text-sm font-medium text-primary">{fmt(t.progress.leaderboardYou, { rank: digits(leaderboard.userRank.rank), xp: digits(leaderboard.userRank.weeklyXp) })}</p>}</CardContent></Card></section>
      <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">{t.progress.badgesTitle}</h2><Medal className="text-amber-600" size={22} aria-hidden /></div><div className="grid gap-3 sm:grid-cols-2">{badges.map(badge => <Card key={badge.id} className={!badge.earned ? "opacity-60" : undefined}><CardContent className="flex gap-3 py-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-xl">{badge.iconRef || "★"}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{badge.name}</p>{badge.earned && <Badge variant="success">{t.progress.earned}</Badge>}</div><p className="mt-1 text-sm leading-6 text-muted-foreground">{badge.description}</p></div></CardContent></Card>)}</div>{badges.length === 0 && <p className="text-sm text-muted-foreground">{t.progress.noBadges}</p>}</section>
    </>}
  </div>
}
