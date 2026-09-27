"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Clock3, Gift, Play, Zap } from "lucide-react"
import { api, type DailyChallenge } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { digits } from "@/lib/utils"

export default function DailyPage() {
  const router = useRouter()
  const [daily, setDaily] = useState<DailyChallenge | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { api.getDailyChallenge().then(setDaily).catch(() => setError('چالش امروز در دسترس نیست.')) }, [])
  const start = async () => { setBusy(true); setError(null); try { const { sessionId } = await api.startDailyChallenge(); router.push(`/sessions/${sessionId}`) } catch (err: any) { setError(err?.message || 'شروع چالش ناموفق بود.'); setBusy(false) } }
  return <div className="space-y-5"><Button variant="ghost" className="touch-target -mr-2 gap-2" onClick={() => router.push('/home')}><ArrowRight size={17} />بازگشت به خانه</Button><section className="rounded-3xl border border-primary/20 bg-primary/[0.06] p-6"><p className="text-xs font-bold text-primary">چالش روزانه · {new Date().toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' })}</p><h1 className="mt-3 text-2xl font-extrabold leading-9">{daily?.title || 'چالش امروز'}</h1><p className="mt-3 text-sm leading-7 text-muted-foreground">{daily?.summary || 'هر روز یک سناریوی تازه تمرین کنید و امتیاز روزانه بگیرید.'}</p></section>{daily && <Card><CardContent className="space-y-4 py-5"><div className="flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-muted px-3 py-2">{daily.difficulty === 'easy' ? 'آسان' : daily.difficulty === 'hard' ? 'سخت' : 'متوسط'}</span><span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-2"><Clock3 size={14} />حدود {digits(daily.estimatedMinutes)} دقیقه</span><span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-2"><Zap size={14} />{digits(daily.bonusXp)} امتیاز روزانه</span></div><p className="flex items-center gap-2 text-sm text-muted-foreground"><Gift size={18} className="text-primary" />پاداش این چالش فقط یک‌بار در روز ثبت می‌شود؛ تمرین مراحل مسیر همچنان جداست.</p>{daily.completed && daily.sessionId ? <Button className="touch-target w-full" onClick={() => router.push(`/sessions/${daily.sessionId}/summary`)}>دیدن نتیجهٔ امروز</Button> : <Button className="touch-target w-full gap-2" disabled={busy} onClick={() => void start()}><Play size={17} />{busy ? 'در حال شروع…' : daily.sessionId ? 'ادامهٔ چالش امروز' : 'شروع چالش امروز'}</Button>}</CardContent></Card>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div>
}
