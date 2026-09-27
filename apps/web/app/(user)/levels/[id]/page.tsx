"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowRight, Clock3, FileImage, ListChecks, PenLine, Play, Table2, Zap } from "lucide-react"
import { api, type LevelOnPath } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { digits } from "@/lib/utils"

export default function LevelIntroPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [level, setLevel] = useState<LevelOnPath | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getLevels().then(({ levels }) => {
      const found = levels.find(item => item.id === id)
      if (!found || found.progress.status === 'locked') { router.replace('/home'); return }
      setLevel(found)
    }).catch(() => setError('اطلاعات چالش بارگذاری نشد.')).finally(() => setLoading(false))
  }, [id, router])

  const start = async () => {
    if (!level || starting) return
    setStarting(true); setError(null)
    try {
      const { sessionId } = await api.startLevel(level.id)
      router.push(`/sessions/${sessionId}`)
    } catch (err: any) {
      setError(err?.message || 'شروع چالش ناموفق بود.')
      setStarting(false)
    }
  }

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><div className="h-9 w-9 animate-spin rounded-full border-4 border-primary/20 border-t-primary" /></div>
  if (!level) return <div role="alert">{error || 'این چالش در دسترس نیست.'}</div>

  const materials = [
    level.materialKinds.includes('table') && { icon: Table2, text: 'جدول داده' },
    level.materialKinds.includes('image') && { icon: FileImage, text: 'تصویر مسئله' },
    level.materialKinds.includes('written-answer') && { icon: PenLine, text: 'پاسخ تشریحی' }
  ].filter(Boolean) as Array<{ icon: typeof Table2; text: string }>

  return <div className="space-y-5 pb-4">
    <Button variant="ghost" className="touch-target -mr-2 gap-2" onClick={() => router.push('/home')}><ArrowRight size={17} />بازگشت به مسیر</Button>
    <section className="rounded-3xl border border-primary/20 bg-primary/[0.06] p-5 sm:p-7">
      <p className="text-xs font-bold text-primary">مرحلهٔ {digits(level.number)} · {level.industry.name}</p>
      <h1 className="mt-3 text-2xl font-extrabold leading-9">{level.title}</h1>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">{level.summary || 'در این سناریو با یک تصمیم واقعی روبه‌رو می‌شوید. داده‌ها را بررسی کنید، انتخابتان را ثبت کنید و از نتیجه یاد بگیرید.'}</p>
      <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold">
        <span className="rounded-full bg-card px-3 py-2">{level.difficulty === 'easy' ? 'آسان' : level.difficulty === 'hard' ? 'سخت' : 'متوسط'}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-card px-3 py-2"><Clock3 size={14} />حدود {digits(level.estimatedMinutes)} دقیقه</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-card px-3 py-2"><Zap size={14} />تا {digits(level.maxXp)} امتیاز</span>
      </div>
    </section>
    <Card><CardContent className="space-y-4 py-5"><h2 className="flex items-center gap-2 font-extrabold"><ListChecks size={18} className="text-primary" />در این چالش چه می‌کنید؟</h2><p className="text-sm leading-7 text-muted-foreground">حدود {digits(level.questionCount)} موقعیت تصمیم‌گیری پیش رو دارید. بعد از هر تصمیم نتیجه را می‌بینید و در پایان، گزارش مهارت‌هایتان ثبت می‌شود.</p>{level.skillNames.length > 0 && <div className="flex flex-wrap gap-2">{level.skillNames.map(name => <span key={name} className="rounded-full border px-3 py-1.5 text-xs font-semibold">{name}</span>)}</div>}{materials.length > 0 && <div className="border-t pt-3"><p className="mb-2 text-xs font-bold text-muted-foreground">داده‌ها و شیوهٔ پاسخ</p><div className="flex flex-wrap gap-2">{materials.map(({ icon: Icon, text }) => <span key={text} className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-xs"><Icon size={14} />{text}</span>)}</div></div>}</CardContent></Card>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button className="touch-target w-full gap-2" disabled={starting} onClick={start}><Play size={17} />{starting ? 'در حال شروع…' : level.progress.status === 'passed' ? 'تکرار چالش' : 'شروع چالش'}</Button>
  </div>
}
