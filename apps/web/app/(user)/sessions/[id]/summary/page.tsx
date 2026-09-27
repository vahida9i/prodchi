"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { SessionResult } from "@/components/challenge/SessionResult"
import { api } from "@/lib/api-client"

type Summary = Awaited<ReturnType<typeof api.getSessionSummary>>

export default function SessionSummaryPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setSummary(await api.getSessionSummary(sessionId))
    } catch (err: any) {
      if (err?.status === 401) {
        router.push("/login")
        return
      }
      setError(err?.status === 409 ? "این سناریو هنوز کامل نشده است." : "بارگذاری نتیجه ناموفق بود.")
    } finally {
      setLoading(false)
    }
  }, [sessionId, router])

  useEffect(() => { void load() }, [load])

  if (loading) {
    return <div role="status" className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">در حال آماده‌سازی نتیجه…</div>
  }

  if (!summary) {
    return <div className="mx-auto max-w-lg rounded-2xl border bg-card p-6 text-center shadow-sm"><h1 className="text-lg font-extrabold">{error ?? "نتیجه پیدا نشد."}</h1><div className="mt-5 flex justify-center gap-2"><Button variant="outline" onClick={() => router.push("/home")}>بازگشت به مسیر</Button><Button onClick={() => void load()}>تلاش دوباره</Button></div></div>
  }

  return <SessionResult title={summary.challengeTitle} summary={summary} onBack={() => router.push("/home")} />
}
