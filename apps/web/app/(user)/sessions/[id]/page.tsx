"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowRight, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StepOptionList } from "@/components/challenge/StepOptionList"
import { RevealBlock } from "@/components/challenge/RevealBlock"
import { RewardSummary } from "@/components/challenge/RewardSummary"
import { api, AuthoredReveal, SanitizedQuestion, SessionHistoryEntry, LevelCompletion, RevealBlock as RevealBlockData } from "@/lib/api-client"
import { digits, fmt, getTranslations } from "@/lib/i18n"

function hasReveal(reveal: AuthoredReveal | RevealBlockData | null | undefined): boolean {
  if (typeof reveal === "string") return reveal.trim().length > 0
  return Boolean(reveal?.text || reveal?.table)
}

export default function SessionPage() {
  const params = useParams()
  const router = useRouter()
  const t = getTranslations()
  const sessionId = params.id as string
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [challengeTitle, setChallengeTitle] = useState("")
  const [summary, setSummary] = useState<string | null>(null)
  const [answeredCount, setAnsweredCount] = useState(0)
  const [question, setQuestion] = useState<SanitizedQuestion | null>(null)
  const [history, setHistory] = useState<SessionHistoryEntry[]>([])
  const [reveal, setReveal] = useState<RevealBlockData | null>(null)
  const [finished, setFinished] = useState(false)
  const [result, setResult] = useState<LevelCompletion | null>(null)
  const [answering, setAnswering] = useState(false)
  const pendingRef = useRef<SanitizedQuestion | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.getSession(sessionId)
        if (data.status === "completed") { router.replace(`/sessions/${sessionId}/summary`); return }
        setChallengeTitle(data.challengeTitle); setSummary(data.summary); setAnsweredCount(data.answeredCount); setQuestion(data.question); setHistory(data.history)
        if (!data.question) setError(t.session.invalidState)
      } catch (err: any) {
        if (err?.status === 401) { router.push("/login"); return }
        setError(t.session.loadError)
      } finally { setLoading(false) }
    }
    load()
  }, [sessionId, router])

  const applyNext = useCallback((next: SanitizedQuestion | null) => { pendingRef.current = null; setReveal(null); setQuestion(next) }, [])

  const handleAnswer = async (choiceIndex: number) => {
    if (answering || reveal !== null || !question) return
    setAnswering(true); setError(null)
    try {
      const response = await api.answerSession(sessionId, choiceIndex)
      setHistory(prev => [...prev, { questionText: question.text, choiceText: question.choices.find(c => c.index === choiceIndex)?.text ?? "", reveal: response.reveal }])
      setAnsweredCount(count => count + 1); setReveal(response.reveal)
      if (response.status === "completed") { setFinished(true); setResult(response.result ?? null) } else pendingRef.current = response.question
    } catch (err: any) {
      if (err?.status === 409 && !err?.restart) {
        try { const fresh = await api.getSession(sessionId); if (fresh.status === "completed") { router.replace(`/sessions/${sessionId}/summary`); return }; setHistory(fresh.history); setAnsweredCount(fresh.answeredCount); applyNext(fresh.question); return } catch {}
      }
      setError(t.session.submitError)
    } finally { setAnswering(false) }
  }

  const handleContinue = () => finished ? router.push(`/sessions/${sessionId}/summary`) : applyNext(pendingRef.current)
  const pathReveals = history.filter(entry => hasReveal(entry.reveal))

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-9 w-9 animate-spin rounded-full border-4 border-primary/20 border-t-primary" /></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3"><Button type="button" variant="ghost" className="touch-target -mr-2" onClick={() => router.push("/home")}><ArrowRight size={18} aria-hidden /> خروج</Button><span className="text-sm font-semibold text-muted-foreground">{fmt(t.session.answered, { n: digits(answeredCount) })}</span></div>
      <section className="space-y-2"><p className="text-xs font-semibold text-primary">{t.nav.level} {digits(answeredCount + 1)}</p><h1 className="text-2xl font-extrabold leading-9">{challengeTitle}</h1>{summary && <p className="text-sm leading-7 text-muted-foreground">{summary}</p>}</section>
      <div className="space-y-2"><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{fmt(t.session.questionNumber, { n: digits(answeredCount + (reveal ? 0 : 1)) })}</span><span>{answeredCount ? <>{digits(answeredCount)} {t.session.answered.split(" ")[1] ?? "پاسخ"}</> : "شروع"}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted" dir="rtl"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, Math.max(8, answeredCount * 18))}%` }} /></div></div>

      {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      {question && reveal === null && <Card><CardHeader className="pb-3"><CardTitle className="text-base">تصمیم شما چیست؟</CardTitle></CardHeader><CardContent><StepOptionList question={question} onAnswer={handleAnswer} disabled={answering} /></CardContent></Card>}

      {reveal !== null && <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg">{finished ? <><CheckCircle2 className="text-primary" size={21} aria-hidden />{t.session.sessionComplete}</> : t.session.outcome}</CardTitle></CardHeader><CardContent className="space-y-5"><RevealBlock reveal={reveal} />{finished && result ? <RewardSummary result={result} onContinue={handleContinue} onBack={() => router.push("/home")} /> : <><p className="text-sm leading-7 text-muted-foreground">{t.session.takeYourTime}</p><Button className="touch-target w-full" onClick={handleContinue}>{t.session.continue}</Button></>}</CardContent></Card>}

      {pathReveals.length > 0 && <details className="rounded-2xl border bg-card p-4"><summary className="cursor-pointer text-sm font-bold">{t.session.findingsRecap}</summary><div className="mt-4 space-y-4">{pathReveals.map((entry, index) => <div key={index} className="border-r-2 border-primary/30 pr-3"><RevealBlock reveal={entry.reveal} variant="compact" /></div>)}</div></details>}
    </div>
  )
}
