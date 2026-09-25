"use client"

import { Check, FileText, Play, LockKeyhole, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { digits, fmt, getTranslations } from "@/lib/i18n"
import type { LevelOnPath } from "@/lib/api-client"

export function LevelNode({ level, isCurrent, isLast, startingId, onStart, onViewSummary }: {
  level: LevelOnPath
  isCurrent: boolean
  isLast: boolean
  startingId: string | null
  onStart: (level: LevelOnPath) => void
  onViewSummary?: (level: LevelOnPath) => void
}) {
  const t = getTranslations()
  const locked = level.progress.status === "locked"
  const passed = level.progress.status === "passed"
  const loading = startingId === level.id
  const stars = `${"★".repeat(level.progress.bestStars)}${"☆".repeat(Math.max(0, 3 - level.progress.bestStars))}`

  return (
    <li className={cn("relative flex gap-4 pb-8 last:pb-0", locked && "opacity-60")} aria-current={isCurrent ? "step" : undefined}>
      <div className="relative flex w-12 shrink-0 justify-center">
        {!isLast && <span aria-hidden className={cn("absolute top-12 h-[calc(100%-2.25rem)] w-1 rounded-full", passed ? "bg-primary" : "bg-border")} />}
        <span aria-label={locked ? t.path.lockedLevelAria : fmt(t.path.levelAria, { n: level.number })} className={cn(
          "relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-4 bg-card text-sm font-extrabold shadow-sm",
          passed && "border-primary bg-primary text-primary-foreground",
          locked && "border-muted bg-muted text-muted-foreground",
          !passed && !locked && (isCurrent ? "border-primary text-primary ring-4 ring-primary/15" : "border-primary/35 text-primary/70")
        )}>
          {passed ? <Check size={22} strokeWidth={3} aria-hidden /> : locked ? <LockKeyhole size={19} aria-hidden /> : digits(level.number)}
        </span>
      </div>
      <div className={cn("min-w-0 flex-1 rounded-2xl border bg-card p-4 shadow-sm", isCurrent && "border-primary/40 shadow-md shadow-primary/10")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground">{fmt(t.path.levelAria, { n: level.number })}</p>
            <h3 className="mt-1 text-base font-bold leading-6">{level.title}</h3>
          </div>
          <span className="shrink-0 rounded-full bg-secondary px-2 py-1 text-xs font-semibold text-secondary-foreground">{level.type === "single_question" ? t.path.singleQuestionBadge : t.path.scenarioBadge}</span>
        </div>
        {level.summary && <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{level.summary}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{level.industry.name}</span><span>{digits(level.xpPerBest)} {t.nav.xp}</span>{passed && <span className="font-semibold text-amber-600">{stars}</span>}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {passed && level.progress.lastSessionId && <Button type="button" variant="outline" className="touch-target inline-flex flex-1 items-center justify-center gap-2" onClick={() => onViewSummary?.(level)}><FileText size={16} aria-hidden />مرور نتیجه</Button>}
          <Button type="button" variant={isCurrent || passed ? "default" : "outline"} className="touch-target inline-flex flex-1 items-center justify-center gap-2" disabled={locked || loading} onClick={() => onStart(level)}>
            {loading ? t.session.submitting : locked ? t.path.locked : passed ? <><RotateCcw size={16} aria-hidden /> <span>{t.summary.retry}</span></> : <><Play size={16} aria-hidden /> <span>{isCurrent ? t.path.resumeLevel : t.path.startLevel}</span></>}
          </Button>
        </div>
      </div>
    </li>
  )
}
