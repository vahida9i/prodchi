"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { api, type BadgeInfo } from "@/lib/api-client"
import { Card, CardContent } from "@/components/ui/card"
import { digits } from "@/lib/utils"

export default function BadgesPage() {
  const [badges, setBadges] = useState<BadgeInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { api.getBadges().then(result => setBadges(result.badges)).catch(() => setError('مدال‌ها بارگذاری نشدند.')).finally(() => setLoading(false)) }, [])
  if (loading) return <div className="py-20 text-center text-sm text-muted-foreground">در حال بارگذاری مدال‌ها…</div>
  const earned = badges.filter(badge => badge.earned).length
  return <div className="space-y-5"><div><Link href="/progress" className="text-sm font-bold text-primary">بازگشت به پیشرفت</Link><h1 className="mt-3 text-2xl font-extrabold">مجموعهٔ مدال‌ها</h1><p className="mt-2 text-sm text-muted-foreground">{digits(earned)} از {digits(badges.length)} مدال کسب شده</p></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${badges.length ? earned / badges.length * 100 : 0}%` }} /></div><div className="grid gap-3 sm:grid-cols-2">{badges.map(badge => <Card key={badge.id} className={badge.earned ? '' : 'bg-muted/25'}><CardContent className="flex gap-4 py-5"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-2xl" aria-hidden>{badge.earned ? badge.iconRef : '🔒'}</div><div className="min-w-0 flex-1"><h2 className="font-bold">{badge.name}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{badge.description}</p>{badge.earned ? <p className="mt-2 text-xs font-semibold text-primary">کسب‌شده در {badge.earnedAt ? new Date(badge.earnedAt).toLocaleDateString('fa-IR') : ''}</p> : <><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${badge.progress.percent}%` }} /></div><p className="mt-1 text-xs text-muted-foreground">{digits(badge.progress.current)} از {digits(badge.progress.target)}</p></>}</div></CardContent></Card>)}</div></div>
}
