"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api-client"
import type { LevelOnPath } from "@/lib/api-client"
import { PathMap } from "@/components/challenge/PathMap"

/**
 * The candidate home: the one level path. Pass a level by reaching its END;
 * every best call earns 10 XP, and replays can improve a best run but never
 * add XP. Levels are only playable in path order — the server enforces the
 * gate.
 */
export default function HomePage() {
  const router = useRouter()
  const [levels, setLevels] = useState<LevelOnPath[]>([])
  const [loading, setLoading] = useState(true)
  const [startingId, setStartingId] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const levelsRes = await api.getLevels()
        setLevels(levelsRes.levels)
      } catch (err: any) {
        if (err?.status === 401) {
          router.push("/login")
          return
        }
        console.error("Failed to load home:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [router])

  const handleStartLevel = async (level: LevelOnPath) => {
    setStartingId(level.id)
    try {
      const res = await api.startLevel(level.id)
      router.push(`/sessions/${res.sessionId}`)
    } catch (err: any) {
      if (err?.status === 401) {
        router.push("/login")
        return
      }
      // 403 = locked server-side; everything else is surfaced as-is.
      alert(err.message || "Failed to start level")
    } finally {
      setStartingId(null)
    }
  }

  /** The recap of a level's latest finished run — only a finished level has one. */
  const handleViewSummary = (level: LevelOnPath) => {
    const sessionId = level.progress.lastSessionId
    if (sessionId) router.push(`/sessions/${sessionId}/summary`)
  }

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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Baaten</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push("/profile")}>
              Profile
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push("/progress")}>
              Progress
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Log out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-10">
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Your path</h2>
            <p className="text-sm text-muted-foreground">
              Pass a level by reaching the end of the scenario. Every best call earns 10 XP —
              replays can improve your best run but never add XP.
            </p>
          </div>
          <PathMap
            levels={levels}
            startingId={startingId}
            onStart={handleStartLevel}
            onViewSummary={handleViewSummary}
          />
        </section>
      </main>
    </div>
  )
}