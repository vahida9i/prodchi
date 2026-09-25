"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RoleSelect } from "@/components/RoleSelect"
import { api } from "@/lib/api-client"
import { getTranslations } from "@/lib/i18n"

/**
 * First-run role selection (post-signup, and the redirect target of the (user)
 * layout gate). Users who already carry a track are bounced to /home — only
 * /role switches. The selector itself is shared with /role so the two screens
 * cannot drift. On success RoleSelect lands on /home, which renders the chosen
 * track's path.
 */
export default function OnboardingPage() {
  const router = useRouter()
  const t = getTranslations()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const me = await api.getMe()
        if (cancelled) return
        if (me.user.roleTrackId) {
          router.replace("/home")
          return
        }
      } catch (err: any) {
        if (!cancelled && err?.status === 401) {
          router.replace("/login")
          return
        }
        // Any other failure: stay and let the selector surface it.
      } finally {
        if (!cancelled) setChecking(false)
      }
    }
    check()
    return () => { cancelled = true }
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
          {checking ? (
            <p className="text-sm text-muted-foreground text-center">در حال بارگذاری…</p>
          ) : (
            <RoleSelect />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
