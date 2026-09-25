"use client"

import { Fragment } from "react"
import { LockKeyhole } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { getTranslations } from "@/lib/i18n"
import type { LevelOnPath } from "@/lib/api-client"
import { LevelNode } from "@/components/challenge/LevelNode"

export function PathMap({ levels, startingId, onStart, onViewSummary }: {
  levels: LevelOnPath[]
  startingId: string | null
  onStart: (level: LevelOnPath) => void
  onViewSummary?: (level: LevelOnPath) => void
}) {
  const t = getTranslations()
  if (levels.length === 0) return <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">{t.path.empty}</CardContent></Card>
  const currentIndex = levels.findIndex(level => level.progress.status === "unlocked")
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-200 text-lg" aria-hidden>★</span><div><p className="text-sm font-bold">هدف امروز</p><p className="text-xs text-amber-900/75">یک مرحله را کامل کنید تا زنجیره‌تان حفظ شود.</p></div></div>
      <div className="flex items-center gap-2 px-1 text-sm font-bold"><span className="h-2 w-2 rounded-full bg-primary" aria-hidden />مسیر یادگیری</div>
      <ol aria-label={t.path.title} className="pt-2">
        {levels.map((level, index) => <Fragment key={level.id}>
          {(index === 0 || level.industry.id !== levels[index - 1]?.industry.id) && <li className="mb-4 mt-1 flex items-center gap-3 text-xs font-bold text-muted-foreground"><span className="h-px flex-1 bg-border" /><span className="rounded-full bg-muted px-3 py-1">{level.industry.name}</span><span className="h-px flex-1 bg-border" /></li>}
          <LevelNode level={level} isCurrent={index === currentIndex} isLast={index === levels.length - 1} startingId={startingId} onStart={onStart} onViewSummary={onViewSummary} />
        </Fragment>)}
      </ol>
      <p className="flex items-center justify-center gap-1 text-center text-xs text-muted-foreground"><LockKeyhole size={13} aria-hidden /> مرحله‌های بعدی با پیشروی شما باز می‌شوند.</p>
    </div>
  )
}
