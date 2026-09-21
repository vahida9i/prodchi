"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api-client"
import type { ProgressSummary, BadgeInfo, Leaderboard } from "@/lib/api-client"

/**
 * Progress + gamification reads: XP/player level, stars, levels passed,
 * streak, per-industry rollups, the weekly cohort leaderboard and badges.
 * Everything here is aggregated on read from LevelProgress by the API.
 */
export default function ProgressPage() {
  const router = useRouter()
  const [progress, setProgress] = useState<ProgressSummary | null>(null)
  const [badges, setBadges] = useState<BadgeInfo[]>([])
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [progressRes, badgesRes, leaderboardRes] = await Promise.all([
          api.getProgress(),
          api.getBadges(),
          api.getLeaderboard()
        ])
        setProgress(progressRes)
        setBadges(badgesRes.badges)
        setLeaderboard(leaderboardRes)
      } catch (err: any) {
        if (err?.status === 401) {
          router.push("/login")
          return
        }
        setError(err.message || "Failed to load progress")
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Baaten</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push("/home")}>
              Back to path
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Log out
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

        {progress && (
          <>
            <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="py-4 text-center">
                  <p className="text-3xl font-bold">{progress.totalXp}</p>
                  <p className="text-xs text-muted-foreground">Total XP · level {progress.playerLevel}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center">
                  <p className="text-3xl font-bold text-yellow-500">{progress.totalStars}</p>
                  <p className="text-xs text-muted-foreground">Stars</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center">
                  <p className="text-3xl font-bold">
                    {progress.levelsPassed}/{progress.levelsTotal}
                  </p>
                  <p className="text-xs text-muted-foreground">Levels passed</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center">
                  <p className="text-3xl font-bold">{Math.round(progress.accuracy * 100)}%</p>
                  <p className="text-xs text-muted-foreground">Best-call accuracy</p>
                </CardContent>
              </Card>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Streak</h2>
              <Card>
                <CardContent className="py-4">
                  <p className="text-lg font-semibold">🔥 {progress.streak.currentStreak}-day streak</p>
                  <p className="text-sm text-muted-foreground">
                    Longest: {progress.streak.longestStreak} day
                    {progress.streak.longestStreak === 1 ? "" : "s"} — a day counts when a level is passed.
                  </p>
                </CardContent>
              </Card>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Industries</h2>
              <div className="space-y-3">
                {progress.industries.map(industry => (
                  <Card key={industry.id}>
                    <CardContent className="py-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{industry.name}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-yellow-500">{industry.stars}★</span>
                          {industry.completed && <Badge>Completed</Badge>}
                        </div>
                      </div>
                      <div className="h-2 overflow-hidden rounded bg-muted">
                        <div
                          className="h-2 rounded bg-primary"
                          style={{
                            width: `${industry.levelsTotal === 0 ? 0 : Math.round((industry.levelsPassed / industry.levelsTotal) * 100)}%`
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {industry.levelsPassed}/{industry.levelsTotal} levels passed
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Weekly leaderboard</h2>
              <Card>
                <CardContent className="py-4">
                  {leaderboard && leaderboard.leaderboard.length > 0 ? (
                    <div className="space-y-2">
                      {leaderboard.leaderboard.map(row => (
                        <div key={row.userId} className="flex items-center justify-between text-sm">
                          <span>
                            <span className="mr-2 font-semibold">#{row.rank}</span>
                            {row.player}
                          </span>
                          <span className="font-medium">{row.weeklyXp} XP</span>
                        </div>
                      ))}
                      {leaderboard.userRank && (
                        <p className="pt-2 text-sm text-muted-foreground">
                          You: #{leaderboard.userRank.rank} with {leaderboard.userRank.weeklyXp} XP this week
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No XP earned in your cohort this week yet.
                    </p>
                  )}
                </CardContent>
              </Card>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Badges</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {badges.map(badge => (
                  <Card key={badge.id} className={badge.earned ? "" : "opacity-60"}>
                    <CardContent className="flex items-start gap-3 py-4">
                      <div className="text-2xl">{badge.iconRef}</div>
                      <div className="min-w-0">
                        <p className="font-medium">
                          {badge.name}
                          {badge.earned && <span className="ml-2 text-xs text-primary">earned</span>}
                        </p>
                        <p className="text-sm text-muted-foreground">{badge.description}</p>
                        {badge.earnedAt && (
                          <p className="text-xs text-muted-foreground">
                            Earned {new Date(badge.earnedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}