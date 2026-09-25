"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Brain, CheckCircle2, Target } from "lucide-react"
import { api } from "@/lib/api-client"
import type { SkillProfile, SkillScore } from "@/lib/api-client"
import { SkillRadar } from "@/components/profile/SkillRadar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { digits, fmt, getTranslations } from "@/lib/i18n"

function proficiencyLabel(proficiency: SkillScore["proficiency"]) { const t = getTranslations(); return proficiency === "strong" ? t.progress.proficiencies.strong : proficiency === "developing" ? t.progress.proficiencies.developing : proficiency === "emerging" ? t.progress.proficiencies.emerging : t.profile.unprovenLabel }
function percent(rate: number) { return `${digits(Math.round(rate * 100))}٪` }

function SkillRow({ skill }: { skill: SkillScore }) {
  const t = getTranslations(); const value = Math.round(skill.rate * 100)
  return <div className="space-y-2"><div className="flex items-center justify-between gap-3"><p className="text-sm font-bold">{skill.name}</p><p className="text-sm font-semibold">{skill.count === 0 ? t.profile.notYetObserved : percent(skill.rate)}</p></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} /></div><p className="text-xs leading-5 text-muted-foreground">{skill.evidence}{skill.count > 0 && ` · ${proficiencyLabel(skill.proficiency)}`}</p></div>
}

export default function ProfilePage() {
  const router = useRouter(); const t = getTranslations(); const [profile, setProfile] = useState<SkillProfile | null>(null); const [roleName, setRoleName] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null)
  useEffect(() => { const load = async () => { try { const [skills, me] = await Promise.all([api.getSkills(), api.getMe()]); setProfile(skills); if (me.user.roleTrackId) { const { roles } = await api.getRoles(); setRoleName(roles.find(role => role.id === me.user.roleTrackId)?.name ?? null) } } catch (err: any) { if (err?.status === 401) { router.push("/login"); return }; setError(t.profile.loadError) } finally { setLoading(false) } }; load() }, [router])
  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-9 w-9 animate-spin rounded-full border-4 border-primary/20 border-t-primary" /></div>
  const skills = profile?.skills ?? []; const strengths = skills.filter(skill => skill.proficiency === "strong"); const growth = skills.filter(skill => skill.proficiency === "emerging"); const hasData = (profile?.decisions ?? 0) > 0; const localizedRole = roleName ? (t.roles.byName[roleName as keyof typeof t.roles.byName]?.name ?? t.profile.roleLabel) : null
  return <div className="space-y-6">
    <section><p className="text-sm text-muted-foreground">حساب کاربری</p><h1 className="mt-1 text-2xl font-extrabold">{t.profile.title}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{localizedRole ? fmt(t.profile.scopedWithRole, { role: localizedRole }) : t.profile.scopedDefault}</p></section>
    {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
    {!hasData ? <Card><CardContent className="space-y-4 py-8 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"><Brain size={28} aria-hidden /></div><h2 className="text-lg font-bold">پروفایل شما با بازی کردن ساخته می‌شود.</h2><p className="text-sm leading-7 text-muted-foreground">{t.profile.emptyPrompt}</p><Button className="touch-target" onClick={() => router.push("/home")}>{t.profile.goToPath}<ArrowLeft size={16} aria-hidden /></Button></CardContent></Card> : <>
      <div className="grid grid-cols-3 gap-2"><Card><CardContent className="py-4 text-center"><p className="text-2xl font-extrabold text-primary">{percent(profile!.overallRate)}</p><p className="mt-1 text-[11px] text-muted-foreground">{t.profile.strongCallRate}</p></CardContent></Card><Card><CardContent className="py-4 text-center"><p className="text-2xl font-extrabold">{digits(profile!.decisions)}</p><p className="mt-1 text-[11px] text-muted-foreground">{t.profile.decisionsGraded}</p></CardContent></Card><Card><CardContent className="py-4 text-center"><p className="text-2xl font-extrabold">{digits(profile!.scenarios)}</p><p className="mt-1 text-[11px] text-muted-foreground">{t.profile.scenariosFinished}</p></CardContent></Card></div>
      <Card><CardContent className="py-5"><div className="flex items-center gap-2"><Target className="text-primary" size={20} aria-hidden /><h2 className="font-extrabold">{localizedRole ? fmt(t.profile.skillsTitleWithRole, { role: localizedRole }) : t.profile.skillsTitleDefault}</h2></div><div className="mt-4"><SkillRadar skills={skills} /></div><p className="mt-3 text-center text-xs leading-5 text-muted-foreground">{t.profile.radarCaption}</p></CardContent></Card>
      {strengths.length > 0 && <section className="space-y-3"><h2 className="text-lg font-extrabold">{t.profile.strengthsTitle}</h2>{strengths.map(skill => <Card key={skill.id}><CardContent className="space-y-2 py-4"><div className="flex items-center gap-2"><CheckCircle2 className="text-primary" size={18} aria-hidden /><p className="font-bold">{skill.name}</p><Badge>{t.progress.proficiencies.strong}</Badge></div><p className="text-sm leading-6 text-muted-foreground">{skill.evidence}</p></CardContent></Card>)}</section>}
      {growth.length > 0 && <section className="space-y-3"><h2 className="text-lg font-extrabold">{t.profile.growthTitle}</h2>{growth.map(skill => <Card key={skill.id}><CardContent className="space-y-2 py-4"><div className="flex items-center gap-2"><p className="font-bold">{skill.name}</p><Badge variant="outline">{t.progress.proficiencies.emerging}</Badge></div><p className="text-sm leading-6 text-muted-foreground">{skill.evidence}</p><p className="rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-950">{skill.growthNote}</p></CardContent></Card>)}</section>}
      <section className="space-y-3"><h2 className="text-lg font-extrabold">{t.profile.allSkillsTitle}</h2><Card><CardContent className="space-y-5 py-5">{skills.map(skill => <SkillRow key={skill.id} skill={skill} />)}</CardContent></Card></section>
    </>}
  </div>
}
