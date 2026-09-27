"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RoleSelect } from "@/components/RoleSelect"
import { api } from "@/lib/api-client"

/**
 * First-run role selection (post-signup, and the redirect target of the (user)
 * layout gate). Users who already carry a track are bounced to /app/home; only
 * /app/role switches. The selector is shared with /app/role so the two screens
 * cannot drift. On success RoleSelect lands on /app/home, which renders the chosen
 * track's path.
 */
export default function OnboardingPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const me = await api.getMe()
        if (cancelled) return
        if (me.user.roleTrackId) {
          router.replace("/app/home")
          return
        }
      } catch (err: any) {
        if (!cancelled && err?.status === 401) {
          router.replace("/app/login")
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
          <CardTitle className="text-2xl font-bold text-center">مسیر تخصصی خود را انتخاب کنید</CardTitle>
          <CardDescription className="text-center">
            نقشی را که می‌خواهید در آن تمرین کنید انتخاب نمایید. هر زمان مایل باشید می‌توانید نقش خود را تغییر دهید.
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
