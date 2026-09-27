"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { BadgeCheck, Briefcase, FileText } from "lucide-react"
import { api, type PublicProfile } from "@/lib/api-client"
import { SkillRadar } from "@/components/profile/SkillRadar"
import { Card, CardContent } from "@/components/ui/card"
import { digits } from "@/lib/utils"

const roleLabels: Record<string, string> = { 'Product Design': 'طراحی محصول', 'Product Management': 'مدیریت محصول', 'Tech Lead': 'تک لید' }

export default function PublicProfilePage() {
  const { token } = useParams<{ token: string }>()
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { api.getPublicProfile(token).then(setProfile).catch(() => setError('این پروفایل در دسترس نیست.')) }, [token])
  if (error) return <main className="mx-auto max-w-2xl px-4 py-16 text-center" role="alert">{error}</main>
  if (!profile) return <main className="mx-auto max-w-2xl px-4 py-16 text-center">در حال بارگذاری پروفایل…</main>
  return <main className="mx-auto max-w-2xl space-y-5 px-4 py-8"><header className="rounded-3xl border bg-card p-6 text-center shadow-sm"><p className="text-xs font-bold text-primary">پروفایل توانمندی پرودچی</p><h1 className="mt-3 text-2xl font-extrabold">{profile.displayName}</h1><p className="mt-1 text-sm text-muted-foreground">{roleLabels[profile.roleName] || profile.roleName}</p><p className="mt-4 text-3xl font-extrabold text-primary">{digits(Math.round(profile.skills.overallRate * 100))}<span className="text-base"> از ۱۰۰</span></p><p className="text-xs text-muted-foreground">امتیاز توانمندی بر پایهٔ تصمیم‌های ثبت‌شده</p>{profile.mentorVerified && <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary"><BadgeCheck size={15} />تأیید مربی</p>}</header><div className="grid grid-cols-3 gap-2">{[[profile.skills.scenarios, 'چالش کامل‌شده'], [profile.caseStudies, 'مطالعهٔ موردی تأییدشده'], [profile.projects, 'پروژهٔ تأییدشده']].map(([value, label]) => <Card key={label}><CardContent className="py-4 text-center"><p className="text-xl font-extrabold">{digits(Number(value))}</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">{label}</p></CardContent></Card>)}</div><Card><CardContent className="py-5"><h2 className="font-extrabold">نقشهٔ مهارت‌ها</h2><div className="mt-4"><SkillRadar skills={profile.skills.skills} /></div><div className="mt-4 space-y-2">{profile.skills.skills.map(skill => <div key={skill.id} className="flex justify-between gap-3 text-sm"><span>{skill.name}</span><span className="font-bold">{skill.count ? `${digits(Math.round(skill.rate * 100))}٪` : 'بدون داده'}</span></div>)}</div></CardContent></Card>{profile.evidence.length > 0 && <section className="space-y-3"><h2 className="font-extrabold">شواهد تأییدشده</h2>{profile.evidence.map(item => <Card key={item.id}><CardContent className="flex gap-3 py-4">{item.type === 'project' ? <Briefcase size={20} className="shrink-0 text-primary" /> : <FileText size={20} className="shrink-0 text-primary" />}<div><h3 className="font-bold">{item.title}</h3><p className="mt-1 text-sm leading-7 text-muted-foreground">{item.description}</p>{item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-bold text-primary underline">مشاهدهٔ مدرک</a>}</div></CardContent></Card>)}</section>}<p className="pb-4 text-center text-xs text-muted-foreground">فقط داده‌ها و شواهدی که صاحب پروفایل برای اشتراک فعال کرده نمایش داده می‌شوند.</p></main>
}
