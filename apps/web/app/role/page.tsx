"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api-client"
import { RoleSelect } from "@/components/RoleSelect"
import { getTranslations } from "@/lib/i18n"

/**
 * The role-select page, revisitable at any time (entry point: the RoleChip in
 * the app headers). First pick, switch, and same-role no-op all flow through
 * RoleSelect; on success the candidate lands on /home showing the selected
 * track's path. Lives OUTSIDE the (user) route group like /onboarding, so it
 * never redirect-loops against the role gate.
 */
export default function RolePage() {
  const router = useRouter()
  const t = getTranslations()
  const [currentRoleId, setCurrentRoleId] = useState<string | null | undefined>(undefined) // undefined = loading
  const [error, setError] = useState('')
  const [retrying, setRetrying] = useState(false)

  const load = async () => {
    setError('')
    try {
      const me = await api.getMe()
      setCurrentRoleId(me.user.roleTrackId)
    } catch (err: any) {
      if (err?.status === 401) {
        router.push("/login")
        return
      }
      setError(t.auth.errorGeneral)
      setCurrentRoleId(null)
    } finally {
      setRetrying(false)
    }
  }

  useEffect(() => {
    load()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 px-4 py-12">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">{t.auth.onboardingTitle}</CardTitle>
          <CardDescription className="text-center">
            {t.auth.onboardingSubtitle}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center justify-center gap-3 text-sm text-destructive text-center">
              <span>{error}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={retrying}
                onClick={() => { setRetrying(true); setCurrentRoleId(undefined); load() }}
              >
                {retrying ? 'Retrying…' : 'Retry'}
              </Button>
            </div>
          )}
          {currentRoleId === undefined ? (
            <p className="text-sm text-muted-foreground text-center">Loading…</p>
          ) : (
            <RoleSelect currentRoleId={currentRoleId} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}