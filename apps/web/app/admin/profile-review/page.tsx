"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { api } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type Review = Awaited<ReturnType<typeof api.getProfileReview>>

export default function ProfileReviewPage() {
  const [review, setReview] = useState<Review | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const load = useCallback(() => api.getProfileReview().then(setReview).catch(() => setError('بارگذاری درخواست‌ها ناموفق بود.')), [])
  useEffect(() => { void load() }, [load])
  const verifyEvidence = async (id: string) => { setBusy(id); try { await api.verifyProfileEvidence(id); await load() } catch (err: any) { setError(err?.message || 'تأیید ناموفق بود.') } finally { setBusy(null) } }
  const verifyUser = async (id: string) => { setBusy(id); try { await api.verifyProfileUser(id); await load() } catch (err: any) { setError(err?.message || 'تأیید ناموفق بود.') } finally { setBusy(null) } }
  return <main dir="rtl" className="mx-auto max-w-3xl space-y-5 px-4 py-8"><Link href="/admin/challenges" className="text-sm font-bold text-primary">بازگشت به مدیریت</Link><h1 className="text-2xl font-extrabold">بررسی شواهد و پروفایل‌ها</h1>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<section className="space-y-3"><h2 className="text-lg font-bold">شواهد در انتظار تأیید</h2>{review?.evidence.length === 0 && <p className="text-sm text-muted-foreground">موردی در انتظار بررسی نیست.</p>}{review?.evidence.map(item => <Card key={item.id}><CardContent className="space-y-2 py-4"><p className="font-bold">{item.title} · {item.type === 'project' ? 'پروژه' : 'مطالعهٔ موردی'}</p><p className="text-xs text-muted-foreground">{item.user.displayName || 'کاربر بدون نام نمایشی'}</p><p className="text-sm leading-7">{item.description}</p>{item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">بررسی مدرک</a>}<div><Button disabled={busy === item.id} onClick={() => void verifyEvidence(item.id)}>تأیید شاهد</Button></div></CardContent></Card>)}</section><section className="space-y-3"><h2 className="text-lg font-bold">تأیید توانمندی توسط مربی</h2>{review?.profiles.map(user => <Card key={user.id}><CardContent className="flex items-center justify-between gap-3 py-4"><span className="text-sm font-bold">{user.displayName || 'کاربر بدون نام نمایشی'}</span>{user.mentorVerifiedAt ? <span className="text-xs font-bold text-primary">تأیید شده</span> : <Button variant="outline" disabled={busy === user.id} onClick={() => void verifyUser(user.id)}>تأیید پروفایل</Button>}</CardContent></Card>)}</section></main>
}
