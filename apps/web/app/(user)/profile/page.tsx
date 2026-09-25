"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api-client"
import type { SkillProfile, SkillScore } from "@/lib/api-client"
import { SkillRadar } from "@/components/profile/SkillRadar"
import { RoleChip } from "@/components/RoleChip"
import { fmt, getTranslations } from "@/lib/i18n"

/**
 * The candidate's skill profile — what they are good at as a designer, read
 * from how they answered. Everything is aggregated on read by the API from the
 * finished runs' recorded decisions (same deterministic weights as the run
 * feedback), so this page has no data of its own and can never contradict a
 * finished run's report.
 */

/** Localized proficiency wording; keys live in the progress/profile sections. */
function proficiencyLabel(proficiency: SkillScore["proficiency"]): string {
  const t = getTranslations()
  if (proficiency === "strong") return t.progress.proficiencies.strong
  if (proficiency === "developing") return t.progress.proficiencies.developing
  if (proficiency === "emerging") return t.progress.proficiencies.emerging
  return t.profile.unprovenLabel
}

function percent(rate: number) {
  return `${Math.round(rate * 100)}%`
}

function barClass(skill: SkillScore) {
  if (skill.proficiency === "strong") return "bg-primary"
  if (skill.proficiency === "developing") return "bg-primary/60"
  if (skill.proficiency === "emerging") return "bg-destructive/70"
  return "bg-muted-foreground/30"
}

/** One row of the role's skill breakdown. */
function SkillRow({ skill }: { skill: SkillScore }) {
  const t = getTranslations()
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{skill.name}</p>
        <p className={`text-sm ${skill.count === 0 ? "text-muted-foreground" : "font-medium"}`}>
          {skill.count === 0 ? t.profile.notYetObserved : percent(skill.rate)}
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded bg-muted">
        <div
          className={`h-2 rounded ${barClass(skill)}`}
          style={{ width: `${Math.round(skill.rate * 100)}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {skill.evidence}
        {skill.thinEvidence ? ` · ${t.profile.needsMoreEvidence}` : ""}
        {skill.count > 0 ? ` — ${proficiencyLabel(skill.proficiency)}` : ""}
      </p>
    </div>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const t = getTranslations()
  const [profile, setProfile] = useState<SkillProfile | null>(null)
  const [roleName, setRoleName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [skillsRes, me] = await Promise.all([api.getSkills(), api.getMe()])
        setProfile(skillsRes)
        if (me.user.roleTrackId) {
          try {
            const { roles } = await api.getRoles()
            setRoleName(roles.find(role => role.id === me.user.roleTrackId)?.name ?? null)
          } catch {
            setRoleName(null)
          }
        }
      } catch (err: any) {
        if (err?.status === 401) {
          router.push("/login")
          return
        }
        setError(err.message || t.profile.loadError)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  const handleLogout = async () => {
    try {
      await api.logout()
    } catch {
      // Cookie clearing is best-effort; always land on the login screen.
    }
    router.push("/login")
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  const skills = profile?.skills ?? []
  const strengths = skills
    .filter(skill => skill.proficiency === "strong")
    .sort((a, b) => b.rate - a.rate || b.count - a.count)
  const growth = skills
    .filter(skill => skill.proficiency === "emerging")
    .sort((a, b) => a.rate - b.rate || b.count - a.count)
  const hasData = (profile?.decisions ?? 0) > 0

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t.appName}</h1>
          <div className="flex items-center gap-2">
            <RoleChip />
            <Button variant="outline" size="sm" onClick={() => router.push("/home")}>
              {t.nav.home}
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              {t.nav.signOut}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-8">
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <section className="space-y-1">
          <h2 className="text-xl font-semibold">{t.profile.skillProfileTitle}</h2>
          {hasData ? (
            <p className="text-sm text-muted-foreground">
              {fmt(t.profile.statsLine, { decisions: profile!.decisions, scenarios: profile!.scenarios })}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{t.profile.buildsAsYouPlay}</p>
          )}
        </section>

        {!hasData ? (
          <Card>
            <CardContent className="py-10 text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                {t.profile.emptyPrompt}
              </p>
              <Button onClick={() => router.push("/home")}>{t.profile.goToPath}</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <section className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="py-4 text-center">
                  <p className="text-3xl font-bold">{percent(profile!.overallRate)}</p>
                  <p className="text-xs text-muted-foreground">{t.profile.strongCallRate}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center">
                  <p className="text-3xl font-bold">{profile!.decisions}</p>
                  <p className="text-xs text-muted-foreground">{t.profile.decisionsGraded}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center">
                  <p className="text-3xl font-bold">{profile!.scenarios}</p>
                  <p className="text-xs text-muted-foreground">{t.profile.scenariosFinished}</p>
                </CardContent>
              </Card>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">
                {roleName
                  ? fmt(t.profile.skillsTitleWithRole, { role: roleName })
                  : t.profile.skillsTitleDefault}
              </h2>
              <p className="mb-3 text-sm text-muted-foreground">
                {roleName
                  ? fmt(t.profile.scopedWithRole, { role: roleName })
                  : t.profile.scopedDefault}
              </p>
              <Card>
                <CardContent className="py-6">
                  <SkillRadar skills={skills} />
                  <p className="mt-4 text-center text-xs text-muted-foreground">
                    {t.profile.radarCaption}
                  </p>
                </CardContent>
              </Card>
            </section>

            {strengths.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-xl font-semibold">{t.profile.strengthsTitle}</h2>
                {strengths.map(skill => (
                  <Card key={skill.id}>
                    <CardContent className="py-4 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{skill.name}</p>
                        <Badge>{t.progress.proficiencies.strong}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{skill.evidence}</p>
                      <p className="text-sm">{skill.blurb}</p>
                    </CardContent>
                  </Card>
                ))}
              </section>
            )}

            {growth.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-xl font-semibold">{t.profile.growthTitle}</h2>
                {growth.map(skill => (
                  <Card key={skill.id}>
                    <CardContent className="py-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{skill.name}</p>
                        <Badge variant="outline">{t.progress.proficiencies.emerging}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{skill.evidence}</p>
                      <p className="text-sm rounded-lg border bg-muted/30 p-3">
                        💡 {skill.growthNote}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </section>
            )}

            <section>
              <h2 className="text-xl font-semibold mb-3">{t.profile.allSkillsTitle}</h2>
              <Card>
                <CardContent className="py-4 space-y-4">
                  {skills.map(skill => (
                    <SkillRow key={skill.id} skill={skill} />
                  ))}
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </main>
    </div>
  )
}