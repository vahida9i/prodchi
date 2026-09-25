"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RevealBlock } from "@/components/challenge/RevealBlock"
import { api } from "@/lib/api-client"
import {
  HEADLINE_TEXT,
  TONE_TEXT,
  TRAJECTORY_TEXT,
  getHeadlineText,
  getToneText,
  getTrajectoryText,
  assessmentRows,
  nextSteps,
  overallStrength,
  overallWeakness
} from "@/lib/run-report"
import type { Tone } from "@/lib/run-report"
import { digits, fmt, getTranslations } from "@/lib/i18n"

type Summary = Awaited<ReturnType<typeof api.getSessionSummary>>
type Feedback = NonNullable<Summary['feedback']>

/** Badge styling per assessment tone — the wording itself lives in lib/run-report. */
const TONE_VARIANT: Record<Tone, 'default' | 'secondary' | 'outline'> = {
  strength: 'default',
  growth: 'secondary',
  steady: 'outline',
  unused: 'outline'
}

/**
 * The end-of-run report (deterministic, rule-based — no AI), in one place: every
 * strand assessed, then one overall strength, one overall weakness, and what to
 * try next. The recorded path stays available — collapsed — below it.
 */
function RunReport({ feedback }: { feedback: Feedback }) {
  const t = getTranslations()
  const rows = assessmentRows(feedback)
  const steps = nextSteps(rows, feedback)

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">{t.summary.title}</h2>
        <Badge variant={feedback.headline === 'strong' ? 'default' : 'secondary'}>
          {getHeadlineText(feedback.headline)}
        </Badge>
          <Badge variant="outline">{digits(Math.round(feedback.rate * 100))}٪ {t.summary.accuracy}</Badge>
      </div>

      {rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map(row => (
            <li
              key={row.key}
              className="flex flex-col gap-1 rounded-md border p-3 sm:flex-row sm:items-center sm:gap-3"
            >
              <Badge variant={TONE_VARIANT[row.tone]} className="w-fit shrink-0">
                {getToneText(row.tone)}
              </Badge>
              <span className="text-sm font-medium">{row.label}</span>
              <span className="text-sm text-muted-foreground">{row.result}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-muted-foreground">
        {fmt(
          feedback.traversal.earlyExit ? t.summary.walkEarly : t.summary.walk,
          { steps: feedback.traversal.steps, strongest: feedback.traversal.strongestRunSteps }
        )}{" "}
        {getTrajectoryText(feedback.trajectory)}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 rounded-lg border p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.summary.overallStrength}</p>
          <p className="text-sm leading-relaxed">{overallStrength(rows, feedback)}</p>
        </div>
        <div className="space-y-1 rounded-lg border p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.summary.overallWeakness}</p>
          <p className="text-sm leading-relaxed">{overallWeakness(rows, feedback)}</p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.summary.whatToTryNext}</p>
        <ol className="list-decimal space-y-1 pl-5 rtl:pr-5 text-sm leading-relaxed">
          {steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/**
 * Session summary (plan Feature 4): the run assessed as a whole — every strand in
 * one list, one overall strength, one overall weakness, and what to try next —
 * with the recorded path (each choice and what it revealed) collapsed below it.
 * When the session belongs to a level on the path, the score of the run shows too.
 */
export default function SessionSummaryPage() {
  const params = useParams()
  const router = useRouter()
  const t = getTranslations()
  const sessionId = params.id as string
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        setSummary(await api.getSessionSummary(sessionId))
      } catch (err: any) {
        if (err?.status === 401) {
          router.push("/login")
          return
        }
        setError(
          err?.status === 409
            ? t.summary.notCompletedYet
            : t.summary.loadError
        )
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [sessionId, router])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (error || !summary) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold mb-2">{error || t.summary.notFound}</h2>
            <Button variant="link" onClick={() => router.push("/home")}>{t.summary.backToLibrary}</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-sm text-muted-foreground">نتیجه‌ی مرحله</p><h1 className="mt-1 text-2xl font-extrabold">{t.summary.cardTitle}</h1></div>
        <Button variant="outline" className="touch-target" onClick={() => router.push("/home")}>{t.summary.continuePath}</Button>
      </div>
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="text-xl">{t.summary.cardTitle}</CardTitle>
            <p className="text-muted-foreground">{summary.challengeTitle}</p>
            <div className="flex flex-wrap items-center gap-2">
              {summary.levelNumber != null && <Badge>{fmt(t.summary.levelBadge, { n: digits(summary.levelNumber) })}</Badge>}
              {summary.score && (
                <>
                  <Badge variant="secondary" className="text-yellow-600">
                    {"★".repeat(summary.score.stars)}{"☆".repeat(Math.max(0, 3 - summary.score.stars))}
                  </Badge>
                  <Badge variant="secondary">
                    {fmt(t.summary.bestCallsBadge, { hits: digits(summary.score.hits), answered: digits(summary.score.answered) })}
                  </Badge>
                  <Badge variant="secondary">{fmt(t.summary.xpBadge, { xp: digits(summary.score.xp) })}</Badge>
                </>
              )}
              {!summary.score && <Badge variant="secondary">{t.summary.reasoningRecord}</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              {fmt(t.summary.completedAt, { date: new Date(summary.completedAt).toLocaleString("fa-IR") })}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {summary.feedback ? (
              <RunReport feedback={summary.feedback} />
            ) : (
              <p className="text-sm text-muted-foreground">
                {t.summary.noAssessment}
              </p>
            )}

            {summary.path.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.summary.noSteps}</p>
            ) : (
              <details className="rounded-lg border p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  {fmt(t.summary.pathRecap, { n: digits(summary.path.length) })}
                </summary>
                <ol className="mt-4 space-y-4">
                  {summary.path.map((entry, i) => (
                    <li key={i} className="space-y-2 border-l-2 pl-3">
                      <p className="text-sm font-medium leading-relaxed">{entry.questionText}</p>
                      <p className="text-sm text-muted-foreground">{fmt(t.summary.youChose, { text: entry.choiceText })}</p>
                      <RevealBlock reveal={entry.reveal} variant="compact" />
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </CardContent>
        </Card>
    </div>
  )
}
