"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Flag, Map, Sparkles, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { api } from "@/lib/api-client"
import { RoleSelect } from "@/components/RoleSelect"
import { getTranslations } from "@/lib/i18n"

export default function RolePage() {
  const router = useRouter()
  const t = getTranslations()
  const [currentRoleId, setCurrentRoleId] = useState<string | null | undefined>(undefined)
  const [error, setError] = useState("")
  const [retrying, setRetrying] = useState(false)

  const load = async () => {
    setError("")
    try {
      const me = await api.getMe()
      setCurrentRoleId(me.user.roleTrackId)
    } catch (err: any) {
      if (err?.status === 401) { router.push("/login"); return }
      setError(t.auth.errorGeneral)
      setCurrentRoleId(null)
    } finally {
      setRetrying(false)
    }
  }

  useEffect(() => { load() }, [router])

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
        {currentRoleId && (
          <Button type="button" variant="ghost" className="touch-target -mr-2 mb-5 gap-2 text-muted-foreground" onClick={() => router.push("/home")}>
            <ArrowRight size={18} aria-hidden />بازگشت به مسیر
          </Button>
        )}

        <section className="text-center">
          <span className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary"><Sparkles size={14} aria-hidden />شروع یک مسیر تازه</span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">از کجا می‌خواهی شروع کنی؟</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">یک نقش را انتخاب کن تا سناریوها، تمرین‌ها و مسیر پیشرفتت بر اساس همان ساخته شود. بعداً هر زمان بخواهی می‌توانی مسیرت را تغییر بدهی.</p>
        </section>

        <Card className="mt-7 border-primary/15 bg-card shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-xs font-bold text-primary">انتخاب مسیر تمرین</p><h2 className="mt-1 text-lg font-extrabold">نقشی را انتخاب کن که می‌خواهی بهترش کنی</h2></div><Target className="text-primary/70" size={24} aria-hidden /></div>
            {error && <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive"><span>{error}</span><Button type="button" variant="outline" size="sm" disabled={retrying} onClick={() => { setRetrying(true); setCurrentRoleId(undefined); load() }}>{retrying ? "در حال تلاش…" : "تلاش دوباره"}</Button></div>}
            {currentRoleId === undefined ? <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Sparkles size={17} className="animate-pulse" aria-hidden />در حال آماده‌سازی انتخاب‌ها…</div> : <RoleSelect currentRoleId={currentRoleId} />}
          </CardContent>
        </Card>

        <section className="mt-6 rounded-2xl border bg-muted/35 p-4 sm:p-5">
          <div className="flex items-center gap-2"><Map className="text-primary" size={19} aria-hidden /><h2 className="text-sm font-extrabold">بعد از انتخاب چه اتفاقی می‌افتد؟</h2></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="flex gap-3 sm:block"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Target size={17} aria-hidden /></span><div className="sm:mt-2"><p className="text-sm font-bold">نقش خودت را مشخص کن</p><p className="mt-1 text-xs leading-5 text-muted-foreground">تمرین‌ها برای هدف تو تنظیم می‌شوند.</p></div></div>
            <div className="flex gap-3 sm:block"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Flag size={17} aria-hidden /></span><div className="sm:mt-2"><p className="text-sm font-bold">سناریو حل کن</p><p className="mt-1 text-xs leading-5 text-muted-foreground">در موقعیت‌های واقعی تصمیم بگیر.</p></div></div>
            <div className="flex gap-3 sm:block"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700"><Map size={17} aria-hidden /></span><div className="sm:mt-2"><p className="text-sm font-bold">مسیر مهارتت را بساز</p><p className="mt-1 text-xs leading-5 text-muted-foreground">با هر مرحله پیشرفتت را ببین.</p></div></div>
          </div>
        </section>
      </main>
    </div>
  )
}
