"use client"

import { ArrowLeft, CheckCircle2, Flame, Medal, RotateCcw, Sparkles, Star, Target, Trophy, Unlock, Zap } from "lucide-react"
import { useEffect, useRef, useState, type CSSProperties } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RevealBlock } from "@/components/challenge/RevealBlock"
import type { AiRunAssessment, DailyReward, LevelCompletion } from "@/lib/api-client"
import { api } from "@/lib/api-client"
import { assessmentRows, getHeadlineText, getToneText, getTrajectoryText, nextSteps, overallStrength, overallWeakness } from "@/lib/run-report"
import type { Tone } from "@/lib/run-report"
import { digits, fmt } from "@/lib/utils"

type Summary = Awaited<ReturnType<typeof api.getSessionSummary>>

const toneStyles: Record<Tone, string> = {
  strength: "border-emerald-200 bg-emerald-50 text-emerald-800",
  growth: "border-amber-200 bg-amber-50 text-amber-800",
  steady: "border-sky-200 bg-sky-50 text-sky-800",
  unused: "border-border bg-muted text-muted-foreground",
}

export function SessionResult({
  title,
  summary,
  completion,
  dailyReward,
  showRewardOnMount = false,
  loading = false,
  error,
  onRetry,
  onBack,
}: {
  title: string
  summary: Summary | null
  completion?: LevelCompletion | null
  dailyReward?: DailyReward | null
  showRewardOnMount?: boolean
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  onBack: () => void
}) {
  const [celebrate, setCelebrate] = useState(showRewardOnMount)
  const [aiAssessment, setAiAssessment] = useState<AiRunAssessment | null>(summary?.aiAssessment ?? null)
  const [aiProgress, setAiProgress] = useState<Partial<Pick<AiRunAssessment, 'strength' | 'weakness' | 'nextStep'>>>({})
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const attemptedAi = useRef(false)
  const requestAi = async (id: string) => {
    setAiLoading(true); setAiError(null); setAiProgress({})
    try { setAiAssessment(await api.streamAiAssessment(id, fields => setAiProgress(fields))) }
    catch (error: any) { setAiProgress({}); setAiError(error?.message || 'ارزیابی هوشمند در دسترس نیست.') }
    finally { setAiLoading(false) }
  }
  useEffect(() => {
    if (!summary) return
    if (summary.aiAssessment) { setAiAssessment(summary.aiAssessment); return }
    if (summary.aiAvailable && !attemptedAi.current) { attemptedAi.current = true; void requestAi(summary.id) }
  }, [summary])
  const score = summary?.score
  const feedback = summary?.feedback
  const stars = completion?.bestStars ?? score?.stars
  const hits = completion?.hits ?? score?.hits
  const answered = completion?.answered ?? score?.answered
  const earnedXp = (completion?.xpGained ?? 0) + (dailyReward?.xpGained ?? 0)
  const xp = showRewardOnMount ? earnedXp : score?.xp
  const leveledUp = Boolean(completion?.leveledUp || dailyReward?.leveledUp)
  const levelNumber = completion?.levelNumber ?? summary?.levelNumber
  const rows = feedback ? assessmentRows(feedback) : []
  const next = feedback ? nextSteps(rows, feedback) : []
  const lastReveal = summary?.path.at(-1)?.reveal
  const hasLastReveal = Boolean(lastReveal?.text || lastReveal?.table)
  const written = summary?.path.flatMap(entry => entry.assessment ? [entry.assessment] : []) ?? []
  const challengeScore = summary?.aiAvailable ? aiAssessment?.score ?? null : (written.length
    ? Math.round(written.reduce((sum, item) => sum + item.score, 0) / written.length)
    : feedback ? Math.round(feedback.rate * 100) : null)

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-4">
      {celebrate && <div role="dialog" aria-modal="true" aria-label="پاداش تکمیل چالش" className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-b from-[#3d4aaf] to-[#22599d] px-6 py-6 text-center text-white">
        {earnedXp > 0 && <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>{Array.from({ length: 32 }, (_, index) => {
          const side = index % 2 === 0 ? 1 : -1
          return <span key={index} className="reward-confetti absolute -bottom-3 h-3 w-2 rounded-sm" style={{ left: side === 1 ? '8%' : '92%', backgroundColor: index % 3 === 0 ? '#facc15' : index % 3 === 1 ? '#93c5fd' : '#fda4af', animationDelay: `${(index % 8) * 60}ms`, '--confetti-x': `${side * (16 + (index % 5) * 7)}vw`, '--confetti-rise': `-${48 + (index % 4) * 7}vh`, '--confetti-r': `${side * (380 + index * 13)}deg` } as CSSProperties} />
        })}</div>}
        <div className="relative mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-sm flex-col">
          <div className="flex justify-end"><button type="button" className="touch-target rounded-lg px-3 text-sm font-bold text-white/80 hover:text-white" onClick={() => setCelebrate(false)}>رد کردن</button></div>
          <div className="flex flex-1 flex-col items-center justify-center py-10">
            <div className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-white/50 bg-white/15 shadow-xl shadow-blue-950/20"><Trophy size={58} className="text-amber-300" strokeWidth={2.2} aria-hidden /></div>
            <h2 className="mt-7 text-3xl font-extrabold leading-tight">{leveledUp ? `سطح ${digits(completion?.playerLevel ?? dailyReward?.playerLevel ?? 0)}!` : dailyReward ? 'چالش امروز را تمام کردی!' : 'چالش را تمام کردی!'}</h2>
            <p className="mt-3 max-w-xs text-sm leading-8 text-white/85">{title}</p>
            {leveledUp && <p className="mt-3 text-sm font-bold text-amber-200">با این چالش به سطح تازه رسیدی</p>}
            {completion?.firstPass && completion.nextLevelNumber != null && <p className="mt-2 text-sm text-white/85">مرحلهٔ {digits(completion.nextLevelNumber)} هم باز شد</p>}
            <div className="mt-7 rounded-full bg-white/20 px-6 py-2.5 text-lg font-extrabold">{earnedXp > 0 ? `+${digits(earnedXp)} XP دریافت کردی` : `${digits(0)} XP تازه`}</div>
            {earnedXp === 0 && <p className="mt-3 max-w-xs text-xs leading-6 text-white/80">{completion?.firstPass === false ? 'امتیاز این مرحله قبلاً ثبت شده است؛ تکرار آن XP تازه ندارد.' : 'این تمرین XP تازه‌ای به حسابت اضافه نمی‌کند.'}</p>}
          </div>
          <Button variant="reward" className="touch-target w-full py-6 text-base font-extrabold" onClick={() => setCelebrate(false)}>دیدن نتیجه</Button>
        </div>
      </div>}
      <section className="relative overflow-hidden rounded-[1.75rem] border border-primary/20 bg-gradient-to-b from-emerald-50 via-white to-white px-5 py-6 shadow-sm sm:px-8 sm:py-8">
        <div className="absolute -left-12 -top-16 h-44 w-44 rounded-full bg-amber-200/25 blur-3xl" aria-hidden />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-primary">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-white/80 px-3 py-1.5"><CheckCircle2 size={15} aria-hidden /> سناریو کامل شد</span>
            {levelNumber != null && <span className="rounded-full border border-primary/15 bg-white/80 px-3 py-1.5">مرحله {digits(levelNumber)}</span>}
          </div>
          <div className="mt-5 flex items-start gap-4">
            <span className={"flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20 " + (completion ? "role-card-pop" : "")}><Trophy size={32} strokeWidth={2.2} aria-hidden /></span>
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">خوب پیش رفتی؛ مسیرت ثبت شد!</h1>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{title}</p>
            </div>
          </div>

          {(stars != null || hits != null || xp != null) && (
            <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-2 py-3 text-center sm:p-4">
                <Star className="mx-auto text-amber-600" size={21} fill="currentColor" aria-hidden />
                <p className="mt-1 text-lg font-extrabold text-amber-900">{digits(stars ?? 0)} <span className="text-xs font-semibold">از ۳</span></p>
                <p className="text-[11px] text-amber-800">ستاره</p>
              </div>
              <div className="rounded-2xl border border-sky-200 bg-sky-50/80 px-2 py-3 text-center sm:p-4">
                <Target className="mx-auto text-sky-700" size={21} aria-hidden />
                <p className="mt-1 text-lg font-extrabold text-sky-950">{digits(hits ?? 0)} <span className="text-xs font-semibold">از {digits(answered ?? 0)}</span></p>
                <p className="text-[11px] text-sky-800">انتخاب برتر</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-2 py-3 text-center sm:p-4">
                <Zap className="mx-auto text-emerald-700" size={21} fill="currentColor" aria-hidden />
                <p className="mt-1 text-lg font-extrabold text-emerald-950">{showRewardOnMount && (xp ?? 0) > 0 ? "+" : ""}{digits(xp ?? 0)}</p>
                <p className="text-[11px] text-emerald-800">{showRewardOnMount ? "XP دریافت‌شده" : "امتیاز عملکرد"}</p>
              </div>
            </div>
          )}

          {(feedback || aiAssessment) && <div className="mt-5 space-y-3 rounded-2xl border border-primary/15 bg-white/90 p-4 text-sm leading-7">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-extrabold">خلاصهٔ عملکرد شما {aiAssessment && <span className="mr-1 text-xs font-semibold text-violet-700">· ارزیابی با هوش مصنوعی</span>}</p><span className="font-extrabold text-primary">{challengeScore === null ? aiError ? 'ارزیابی هوشمند در دسترس نیست' : 'ارزیابی در حال آماده‌سازی' : `${digits(challengeScore)} از ۱۰۰`}</span></div>
            <p><strong>خوب پیش رفت:</strong> {aiAssessment?.strength ?? (feedback ? overallStrength(rows, feedback) : 'تصمیم‌هایت ثبت شد.')}</p>
            <p><strong>برای بهترشدن:</strong> {aiAssessment?.weakness ?? (feedback ? overallWeakness(rows, feedback) : 'جزئیات ارزیابی را پایین ببین.')}</p>
            {(aiAssessment?.nextStep || next[0]) && <p className="rounded-xl bg-primary/10 px-3 py-2 font-semibold text-primary"><strong>قدم بعدی:</strong> {aiAssessment?.nextStep ?? next[0]}</p>}
          </div>}

          {completion && (completion.leveledUp || completion.newBadges.length > 0 || completion.nextLevelNumber != null || completion.streak.currentStreak > 0) && (
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
              {completion.leveledUp && <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-2 text-amber-900"><Sparkles size={15} aria-hidden /> سطح {digits(completion.playerLevel)} باز شد</span>}
              {completion.newBadges.map(badge => <span key={badge.id} className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-2 text-violet-900"><Medal size={15} aria-hidden /> {badge.name}</span>)}
              {completion.nextLevelNumber != null && <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-2 text-sky-900"><Unlock size={15} aria-hidden /> مرحله {digits(completion.nextLevelNumber)} باز شد</span>}
              {completion.streak.currentStreak > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-2 text-orange-900"><Flame size={15} aria-hidden /> تداوم فعالیت: {digits(completion.streak.currentStreak)} روز</span>}
            </div>
          )}
          {(dailyReward || (summary?.dailyReward ?? 0) > 0) && <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-center text-sm font-bold text-amber-900">پاداش چالش روزانه: +{digits(dailyReward?.xpGained ?? summary?.dailyReward ?? 0)} امتیاز</p>}

          <p className="mt-5 text-center text-xs font-medium text-muted-foreground">جزئیات ارزیابی و مسیر تصمیم‌ها پایین همین صفحه است.</p>
        </div>
      </section>

      {loading && <div role="status" className="rounded-2xl border bg-card px-5 py-7 text-center text-sm text-muted-foreground">در حال آماده‌سازی ارزیابی شما…</div>}
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 p-4"><p className="text-sm text-destructive">{error}</p>{onRetry && <Button variant="outline" className="touch-target gap-2" onClick={onRetry}><RotateCcw size={16} aria-hidden /> تلاش دوباره</Button>}</div>}

      {summary && (
        <>
          {summary.aiAvailable && !aiAssessment && (
            <section className="rounded-2xl border border-violet-200 bg-violet-50/40 p-5 shadow-sm sm:p-6" aria-labelledby="ai-assessment-title">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1.5 text-xs font-bold text-violet-800"><Sparkles size={15} aria-hidden /> تولیدشده با هوش مصنوعی</span>
                <h2 id="ai-assessment-title" className="text-sm font-extrabold">ارزیابی تصمیم‌ها</h2>
              </div>
              {aiLoading || (!attemptedAi.current && !aiError) ? (
                <div className="mt-4 space-y-3 text-sm leading-7">
                  <p role="status" className="inline-flex items-center gap-2 text-xs font-semibold text-violet-700"><span className="h-2 w-2 motion-safe:animate-pulse rounded-full bg-violet-500" /> هوش مصنوعی در حال نوشتن است…</p>
                  {aiProgress.strength && <p><strong>نقطهٔ قوت:</strong> {aiProgress.strength}</p>}
                  {aiProgress.weakness && <p><strong>فرصت رشد:</strong> {aiProgress.weakness}</p>}
                  {aiProgress.nextStep && <p><strong>گام بعد:</strong> {aiProgress.nextStep}</p>}
                </div>
              ) : (
                <div className="mt-4 space-y-3"><p role="alert" className="text-sm text-destructive">{aiError || 'ارزیابی هوشمند هنوز آماده نیست.'}</p><Button variant="outline" onClick={() => void requestAi(summary.id)}>تلاش دوباره</Button></div>
              )}
            </section>
          )}
          {hasLastReveal && <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6"><div className="mb-3 flex items-center gap-2"><CheckCircle2 className="text-primary" size={19} aria-hidden /><h2 className="text-base font-extrabold">نتیجهٔ تصمیم آخر</h2></div><RevealBlock reveal={lastReveal} /></section>}

          {feedback ? (
            <details className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 text-sm font-extrabold text-primary">
                <span>جزئیات ارزیابی عملکرد</span>
                <Badge variant={feedback.headline === "strong" ? "default" : "secondary"} className="px-3 py-1.5">{getHeadlineText(feedback.headline)}</Badge>
              </summary>
              <p className="text-xs leading-6 text-muted-foreground">{aiAssessment ? 'نمرهٔ خلاصه با هوش مصنوعی تولید شده است.' : written.length ? 'پاسخ تشریحی با هوش مصنوعی ارزیابی شده است.' : 'نمره بر اساس تصمیم‌های ثبت‌شده محاسبه شده است.'} امتیاز بازی و ستاره‌ها جداگانه محاسبه می‌شوند.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4"><p className="text-xs font-bold text-emerald-800">نقطهٔ قوت</p><p className="mt-2 text-sm leading-7">{overallStrength(rows, feedback)}</p></div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4"><p className="text-xs font-bold text-amber-800">فرصت رشد</p><p className="mt-2 text-sm leading-7">{overallWeakness(rows, feedback)}</p></div>
              </div>
              <div className="rounded-xl bg-muted/50 p-4"><h3 className="text-sm font-extrabold">برای مرحلهٔ بعد چه کار کنی؟</h3><ol className="mt-3 list-decimal space-y-2 pr-5 text-sm leading-7">{next.map((step, index) => <li key={index}>{step}</li>)}</ol></div>
              <p className="text-xs leading-6 text-muted-foreground">{fmt(feedback.traversal.earlyExit ? "مسیر طی‌شده: {steps} گام · بهترین اجرا {strongest} گام داشت — زودتر از موعد تمام کردید." : "مسیر طی‌شده: {steps} گام · بهترین اجرا {strongest} گام داشت.", { steps: feedback.traversal.steps, strongest: feedback.traversal.strongestRunSteps })} {getTrajectoryText(feedback.trajectory)}</p>

              {rows.length > 0 && <details className="group rounded-xl border p-4"><summary className="cursor-pointer text-sm font-bold text-primary">جزئیات مهارت‌های سنجیده‌شده <span className="text-xs text-muted-foreground">({digits(rows.length)} مورد)</span></summary><ul className="mt-4 space-y-3">{rows.map(row => <li key={row.key} className="rounded-xl border bg-muted/20 p-3"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${toneStyles[row.tone]}`}>{getToneText(row.tone)}</span><span className="text-sm font-bold">{row.label}</span></div><p className="mt-2 text-sm leading-6 text-muted-foreground">{row.result}</p></li>)}</ul></details>}
            </details>
          ) : <section className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">این اجرا ارزیابی ضمیمه ندارد؛ مسیر تصمیم‌هایت را در پایین مرور کن.</section>}

          {summary.path.length > 0 && <details className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6"><summary className="cursor-pointer text-base font-extrabold">مرور مسیر تصمیم‌ها <span className="text-xs font-semibold text-muted-foreground">({digits(summary.path.length)} گام)</span></summary><ol className="mt-5 space-y-4">{summary.path.map((entry, index) => <li key={index} className="border-r-2 border-primary/25 pr-4"><p className="text-xs font-bold text-primary">تصمیم {digits(index + 1)}</p><p className="mt-1 text-sm font-bold leading-7">{entry.questionText}</p><p className="mt-1 text-sm leading-7 text-muted-foreground">پاسخ شما: {entry.choiceText}</p>{entry.assessment && <div className="mt-2 rounded-xl border border-violet-200 bg-violet-50/40 p-3 text-sm leading-7"><p className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-800"><Sparkles size={14} aria-hidden /> ارزیابی تولیدشده با هوش مصنوعی</p><p className="font-bold">{digits(entry.assessment.score)} از ۱۰۰</p><p>نقطهٔ قوت: {entry.assessment.strength}</p><p>فرصت رشد: {entry.assessment.weakness}</p></div>}<div className="mt-2"><RevealBlock reveal={entry.reveal} variant="compact" /></div></li>)}</ol></details>}

          <p className="text-center text-xs text-muted-foreground">تکمیل‌شده در {new Date(summary.completedAt).toLocaleString("fa-IR")}</p>
        </>
      )}
      <Button className="touch-target w-full gap-2 font-bold" onClick={onBack}>بازگشت به مسیر <ArrowLeft size={17} aria-hidden /></Button>
    </div>
  )
}
