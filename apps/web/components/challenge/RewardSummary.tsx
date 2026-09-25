"use client"

import { ArrowLeft, Flame, LockKeyhole, Star, Trophy, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { LevelCompletion } from "@/lib/api-client"
import { digits, fmt, getTranslations } from "@/lib/i18n"

export function RewardSummary({ result, onContinue, onBack }: {
  result: LevelCompletion
  onContinue: () => void
  onBack: () => void
}) {
  const t = getTranslations()
  const stars = `${"★".repeat(result.bestStars)}${"☆".repeat(Math.max(0, 3 - result.bestStars))}`
  return (
    <Card className="overflow-hidden border-primary/20">
      <div className="bg-primary px-5 py-6 text-center text-primary-foreground">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/15"><Trophy size={28} aria-hidden /></div>
        <h2 className="mt-3 text-xl font-extrabold">{result.firstPass ? fmt(t.session.levelPassed, { n: digits(result.levelNumber) }) : fmt(t.session.levelAttempt, { n: digits(result.levelNumber), m: digits(result.attempts) })}</h2>
        <p className="mt-1 text-sm text-primary-foreground/80">{result.firstPass ? "مرحله را با موفقیت پشت سر گذاشتید." : "این بار هم یک قدم به تسلط نزدیک‌تر شدید."}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 p-4">
        <div className="rounded-xl bg-amber-50 p-3 text-center"><Star className="mx-auto text-amber-600" size={19} fill="currentColor" aria-hidden /><p className="mt-1 font-bold text-amber-800">{stars}</p><p className="text-[11px] text-amber-700">{t.nav.stars}</p></div>
        <div className="rounded-xl bg-emerald-50 p-3 text-center"><Zap className="mx-auto text-emerald-600" size={19} fill="currentColor" aria-hidden /><p className="mt-1 font-bold text-emerald-800">+{digits(result.xpGained)}</p><p className="text-[11px] text-emerald-700">{t.nav.xp}</p></div>
        <div className="rounded-xl bg-orange-50 p-3 text-center"><Flame className="mx-auto text-orange-600" size={19} fill="currentColor" aria-hidden /><p className="mt-1 font-bold text-orange-800">{digits(result.streak.currentStreak)}</p><p className="text-[11px] text-orange-700">{t.nav.streak}</p></div>
      </div>
      <div className="space-y-3 px-4 pb-5">
        <p className="text-center text-sm text-muted-foreground">{fmt(t.session.bestCalls, { hits: digits(result.hits), answered: digits(result.answered) })} · {fmt(t.session.xpTotal, { xp: digits(result.totalXp) })}</p>
        {result.leveledUp && <p className="rounded-xl bg-primary/10 px-3 py-2 text-center text-sm font-bold text-primary">{fmt(t.session.leveledUp, { n: digits(result.playerLevel) })}</p>}
        {result.newBadges.length > 0 && <div className="rounded-xl border bg-muted/30 p-3"><p className="text-xs font-bold text-muted-foreground">{t.session.newBadges}</p><div className="mt-2 space-y-1">{result.newBadges.map(badge => <p key={badge.id} className="text-sm">{badge.name}</p>)}</div></div>}
        {result.nextLevelNumber != null && <p className="flex items-center gap-2 text-sm text-muted-foreground"><LockKeyhole size={15} aria-hidden />{fmt(t.session.nextLevelUnlocked, { n: digits(result.nextLevelNumber) })}</p>}
        <div className="flex gap-2 pt-1"><Button className="touch-target inline-flex flex-1 items-center justify-center gap-2" onClick={onContinue}><span>مشاهده خلاصه</span><ArrowLeft size={16} aria-hidden /></Button><Button className="touch-target shrink-0" variant="outline" onClick={onBack}>بازگشت</Button></div>
      </div>
    </Card>
  )
}
