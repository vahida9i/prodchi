"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StepOptionList } from "@/components/challenge/StepOptionList"
import { RevealBlock } from "@/components/challenge/RevealBlock"
import { api, SanitizedQuestion, SessionHistoryEntry, LevelCompletion, RevealBlock as RevealBlockData } from "@/lib/api-client"

/**
 * Guided candidate session (plan Feature 3): one question at a time, reveal
 * after each choice. The reveal stays on screen until the candidate clicks
 * Continue — the next question is never advanced to on a timer. Leaving
 * mid-session loses nothing: state lives on the server and the library offers a
 * Resume shortcut.
 */
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
  const [answering, setAnswering] = useState(false)
  const pendingRef = useRef<SanitizedQuestion | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.getSession(sessionId)
        if (data.status === "completed") {
          router.replace(`/sessions/${sessionId}/summary`)
          return
        }
        setChallengeTitle(data.challengeTitle)
        setSummary(data.summary)
        setAnsweredCount(data.answeredCount)
        setQuestion(data.question)
        setHistory(data.history)
        if (data.status === "in_progress" && !data.question) {
          setError("This session is in an invalid state. Start the challenge again from the library.")
        }
      } catch (err: any) {
        if (err?.status === 401) {
          router.push("/login")
          return
        }
        setError(err.message || "Failed to load session")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [sessionId, router])

  const applyNext = useCallback((next: SanitizedQuestion | null) => {
    pendingRef.current = null
    setReveal(null)
    if (next) setQuestion(next)
  }, [])

  const handleAnswer = async (choiceIndex: number) => {
    if (answering || reveal !== null) return
    setAnswering(true)
    setError(null)
    try {
      const response = await api.answerSession(sessionId, choiceIndex)
      const chosenText = question?.choices.find(c => c.index === choiceIndex)?.text ?? ""
      setHistory(prev => [...prev, {
        questionText: question?.text ?? "",
        choiceText: chosenText,
        reveal: response.reveal
      }])
      setAnsweredCount(count => count + 1)
      setReveal(response.reveal)

      if (response.status === "completed") {
        setFinished(true)
        // A level-tagged session carries its score here; free play has none.
        setResult(response.result ?? null)
      } else {
        // Park the next question here; it only appears once the candidate
        // clicks Continue — nothing advances on its own.
        pendingRef.current = response.question
      }
    } catch (err: any) {
      if (err?.status === 409) {
        // The level's content was re-imported while this run was open, so the
        // server retired the session. Send the candidate back to the path to
        // start it again rather than showing a dead end.
        if (err?.restart) {
          setError(err.message)
          setQuestion(null)
          setReveal(null)
          return
        }
        // Another tab (or a retried request) answered this question first:
        // adopt the server's current state instead of dead-ending on an error.
        try {
          const fresh = await api.getSession(sessionId)
          if (fresh.status === "completed") {
            router.replace(`/sessions/${sessionId}/summary`)
            return
          }
          setHistory(fresh.history)
          setAnsweredCount(fresh.answeredCount)
          applyNext(fresh.question)
          return
        } catch {
          // Fall through to the generic error below.
        }
      }
      setError(err.message || "Failed to submit answer")
    } finally {
      setAnswering(false)
    }
  }

  const handleContinue = () => {
    if (finished) {
      router.push(`/sessions/${sessionId}/summary`)
      return
    }
    applyNext(pendingRef.current)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Baaten</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{answeredCount} answered</span>
            <Button variant="outline" size="sm" onClick={() => router.push("/home")}>
              Leave
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        {challengeTitle && (
          <div className="space-y-1">
            <p className="text-sm font-medium">{challengeTitle}</p>
            {/* The authored brief on the business: the context every decision in
                this run sits in, shown before the first question. Absent on
                content imported without one. */}
            {summary && <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p>}
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {question && reveal === null && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-muted-foreground">Question {answeredCount + 1}</CardTitle>
            </CardHeader>
            <CardContent>
              <StepOptionList question={question} onAnswer={handleAnswer} disabled={answering} />
            </CardContent>
          </Card>
        )}

        {reveal !== null && (
          <Card>
            <CardHeader>
              <CardTitle>{finished ? "Session complete" : "What you found"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <RevealBlock reveal={reveal} />
              {finished ? (
                result ? (
                  <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">
                        {result.firstPass
                          ? `Level ${result.levelNumber} passed`
                          : `Level ${result.levelNumber} — attempt ${result.attempts}`}
                      </p>
                      <span className="text-sm text-yellow-500">
                        {"★".repeat(result.bestStars)}{"☆".repeat(Math.max(0, 3 - result.bestStars))}
                      </span>
                    </div>
                    <p className="text-sm">
                      {result.hits}/{result.answered} best calls ·{" "}
                      {result.firstPass ? `+${result.xpGained} XP` : `no new XP (best run ${result.bestXp} XP)`} ·{" "}
                      {result.totalXp} XP total
                    </p>
                    {result.leveledUp && (
                      <p className="text-sm font-medium text-primary">
                        You reached player level {result.playerLevel}!
                      </p>
                    )}
                    {result.newBadges.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          New badges
                        </p>
                        {result.newBadges.map(badge => (
                          <p key={badge.id} className="text-sm">
                            🏅 {badge.name} — {badge.description}
                          </p>
                        ))}
                      </div>
                    )}
                    {result.nextLevelNumber != null && (
                      <p className="text-sm text-muted-foreground">
                        Level {result.nextLevelNumber} is unlocked — find it on your path.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Your full reasoning path is on the summary.
                  </p>
                )
              ) : (
                <p className="text-sm text-muted-foreground">Take your time — continue when you are ready.</p>
              )}
              {finished ? (
                <div className="flex gap-2">
                  <Button onClick={handleContinue}>View summary</Button>
                  <Button variant="outline" onClick={() => router.push("/home")}>
                    Back to path
                  </Button>
                </div>
              ) : (
                <Button onClick={handleContinue}>Continue</Button>
              )}
            </CardContent>
          </Card>
        )}

        {history.length > 0 && (
          <details className="rounded-lg border p-4">
            <summary className="text-sm font-medium cursor-pointer">
              Your path so far ({history.length})
            </summary>
            <ul className="mt-4 space-y-3">
              {history.map((entry, i) => (
                <li key={i} className="text-sm border-l-2 pl-3">
                  <p className="font-medium">{entry.questionText}</p>
                  <p className="text-muted-foreground">You chose: {entry.choiceText}</p>
                  <RevealBlock reveal={entry.reveal} variant="compact" />
                </li>
              ))}
            </ul>
          </details>
        )}
      </main>
    </div>
  )
}