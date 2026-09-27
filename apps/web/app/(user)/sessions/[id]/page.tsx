"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowRight, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StepOptionList } from "@/components/challenge/StepOptionList"
import { RevealBlock } from "@/components/challenge/RevealBlock"
import { SessionResult } from "@/components/challenge/SessionResult"
import { QuestionMaterial } from "@/components/challenge/QuestionMaterial"
import { api, AuthoredReveal, SanitizedQuestion, SessionHistoryEntry, LevelCompletion, DailyReward, RevealBlock as RevealBlockData } from "@/lib/api-client"
import { digits, fmt } from "@/lib/utils"

type CompletedSummary = Awaited<ReturnType<typeof api.getSessionSummary>>

function hasReveal(reveal: AuthoredReveal | RevealBlockData | null | undefined): boolean {
  if (typeof reveal === "string") return reveal.trim().length > 0
  return Boolean(reveal?.text || reveal?.table)
}

export default function SessionPage() {
  const params = useParams()
  const router = useRouter()
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
  const [dailyReward, setDailyReward] = useState<DailyReward | null>(null)
  const [completedSummary, setCompletedSummary] = useState<CompletedSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [answering, setAnswering] = useState(false)
  const [answerText, setAnswerText] = useState("")
  const [writtenAssessment, setWrittenAssessment] = useState<{ score: number; strength: string; weakness: string } | null>(null)
  const [aiProgress, setAiProgress] = useState<{ strength?: string; weakness?: string }>({})
  const pendingRef = useRef<SanitizedQuestion | null>(null)

  const loadCompletedSummary = useCallback(async () => {
    setSummaryLoading(true)
    setSummaryError(null)
    try {
      setCompletedSummary(await api.getSessionSummary(sessionId))
    } catch (err: any) {
      if (err?.status === 401) { router.push("/login"); return }
      setSummaryError("بارگذاری ارزیابی ناموفق بود. دوباره تلاش کنید.")
    } finally {
      setSummaryLoading(false)
    }
  }, [sessionId, router])

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.getSession(sessionId)
        if (data.status === "completed") { router.replace(`/sessions/${sessionId}/summary`); return }
        setChallengeTitle(data.challengeTitle); setSummary(data.summary); setAnsweredCount(data.answeredCount); setQuestion(data.question); setHistory(data.history)
        if (!data.question) setError("این نشست وضعیت نامعتبری دارد. سناریو را دوباره از کتابخانه شروع کنید.")
      } catch (err: any) {
        if (err?.status === 401) { router.push("/login"); return }
        setError("بارگذاری سناریو ناموفق بود")
      } finally { setLoading(false) }
    }
    load()
  }, [sessionId, router])

  const applyNext = useCallback((next: SanitizedQuestion | null) => { pendingRef.current = null; setReveal(null); setQuestion(next); setAnswerText(""); setWrittenAssessment(null); setAiProgress({}) }, [])

  const handleAnswer = async (answer: { choiceIndex: number } | { answerText: string }) => {
    if (answering || reveal !== null || !question) return
    setAnswering(true); setError(null); setAiProgress({})
    try {
      const response = 'answerText' in answer
        ? await api.streamWrittenAnswer(sessionId, answer.answerText, fields => setAiProgress(fields))
        : await api.answerSession(sessionId, answer)
      const choiceText = 'answerText' in answer ? answer.answerText : question.choices.find(c => c.index === answer.choiceIndex)?.text ?? ""
      setHistory(prev => [...prev, { questionText: question.text, choiceText, reveal: response.reveal, ...(response.assessment ? { assessment: response.assessment } : {}) }])
      setAnsweredCount(count => count + 1); setReveal(response.reveal); setWrittenAssessment(response.assessment)
      if (response.status === "completed") {
        setFinished(true)
        setResult(response.result ?? null)
        setDailyReward(response.dailyReward ?? null)
        void loadCompletedSummary()
      } else pendingRef.current = response.question
    } catch (err: any) {
      setAiProgress({})
      if (err?.status === 409 && !err?.restart) {
        try { const fresh = await api.getSession(sessionId); if (fresh.status === "completed") { router.replace(`/sessions/${sessionId}/summary`); return }; setHistory(fresh.history); setAnsweredCount(fresh.answeredCount); applyNext(fresh.question); return } catch {}
      }
      setError(err?.message || "ثبت پاسخ ناموفق بود")
    } finally { setAnswering(false) }
  }

  const handleContinue = () => applyNext(pendingRef.current)
  const pathReveals = history.filter(entry => hasReveal(entry.reveal))

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-9 w-9 animate-spin rounded-full border-4 border-primary/20 border-t-primary" /></div>

  if (finished) return <SessionResult title={completedSummary?.challengeTitle ?? challengeTitle} summary={completedSummary} completion={result} dailyReward={dailyReward} loading={summaryLoading} error={summaryError} onRetry={() => void loadCompletedSummary()} onBack={() => router.push(dailyReward ? "/daily" : "/home")} />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3"><Button type="button" variant="ghost" className="touch-target -mr-2" onClick={() => router.push("/home")}><ArrowRight size={18} aria-hidden /> خروج</Button><span className="text-sm font-semibold text-muted-foreground">{fmt("{n} پاسخ ثبت شد", { n: digits(answeredCount) })}</span></div>
      <section className="space-y-2"><p className="text-xs font-semibold text-primary">مرحله {digits(answeredCount + 1)}</p><h1 className="text-2xl font-extrabold leading-9">{challengeTitle}</h1>{summary && <p className="text-sm leading-7 text-muted-foreground">{summary}</p>}</section>
      <div className="space-y-2"><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{fmt("سؤال {n}", { n: digits(answeredCount + (reveal ? 0 : 1)) })}</span><span>{answeredCount ? <>{digits(answeredCount)} پاسخ</> : "شروع"}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted" dir="rtl"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, Math.max(8, answeredCount * 18))}%` }} /></div></div>

      {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      {question && reveal === null && <Card><CardHeader className="pb-3"><CardTitle className="text-base">تصمیم شما چیست؟</CardTitle></CardHeader><CardContent><QuestionMaterial material={question.material} />{question.answerMode === 'text' ? <form className="space-y-4" onSubmit={event => { event.preventDefault(); void handleAnswer({ answerText: answerText.trim() }) }}><label htmlFor="written-answer" className="block text-sm font-bold leading-7">{question.text}</label><textarea id="written-answer" value={answerText} onChange={event => setAnswerText(event.target.value)} minLength={20} maxLength={2000} required placeholder="دلیل تصمیم خود را با توجه به داده‌ها بنویسید…" className="min-h-36 w-full rounded-xl border bg-background p-3 text-sm leading-7 outline-none focus:border-primary" /><p className="text-xs text-muted-foreground">پاسخ شما برای ارزیابی به سرویس هوش مصنوعی لیارا فرستاده می‌شود و نتیجه در گزارش همین سناریو ثبت می‌شود.</p>{answering && <div className="space-y-2 rounded-xl border border-violet-200 bg-violet-50/40 p-4 text-sm leading-7"><p role="status" className="inline-flex items-center gap-2 text-xs font-bold text-violet-800"><Sparkles size={15} aria-hidden /> هوش مصنوعی در حال نوشتن ارزیابی است…</p>{aiProgress.strength && <p><strong>نقطهٔ قوت:</strong> {aiProgress.strength}</p>}{aiProgress.weakness && <p><strong>فرصت رشد:</strong> {aiProgress.weakness}</p>}</div>}<Button type="submit" disabled={answering || answerText.trim().length < 20} className="touch-target w-full">{answering ? 'در حال ارزیابی…' : 'ثبت و ارزیابی پاسخ'}</Button></form> : <><StepOptionList key={question.key} question={question} onAnswer={choiceIndex => void handleAnswer({ choiceIndex })} disabled={answering} /></>}</CardContent></Card>}

      {reveal !== null && <Card><CardHeader><CardTitle className="text-lg">نتیجه تصمیم شما</CardTitle></CardHeader><CardContent className="space-y-5">{writtenAssessment && <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 text-sm leading-7"><p className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold text-violet-800"><Sparkles size={14} aria-hidden /> ارزیابی تولیدشده با هوش مصنوعی</p><p className="font-extrabold">ارزیابی پاسخ: {digits(writtenAssessment.score)} از ۱۰۰</p><p>نقطهٔ قوت: {writtenAssessment.strength}</p><p>فرصت رشد: {writtenAssessment.weakness}</p></div>}<RevealBlock reveal={reveal} /><p className="text-sm leading-7 text-muted-foreground">عجله نکنید — هر وقت آماده بودید ادامه دهید.</p><Button className="touch-target w-full" onClick={handleContinue}>ادامه</Button></CardContent></Card>}

      {pathReveals.length > 0 && <details className="rounded-2xl border bg-card p-4"><summary className="cursor-pointer text-sm font-bold">آنچه تاکنون یافته‌اید</summary><div className="mt-4 space-y-4">{pathReveals.map((entry, index) => <div key={index} className="border-r-2 border-primary/30 pr-3"><RevealBlock reveal={entry.reveal} variant="compact" /></div>)}</div></details>}
    </div>
  )
}
