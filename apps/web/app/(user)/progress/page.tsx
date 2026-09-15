"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { api } from "@/lib/api-client"
import { StreakCalendar } from "@/components/challenge/StreakCalendar"

export default function ProgressPage() {
  const [profile, setProfile] = useState<any>(null)
  const [leaderboard, setLeaderboard] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profileRes, leaderboardRes] = await Promise.all([
          api.getProfile().catch(() => null),
          api.getLeaderboard().catch(() => null)
        ])
        setProfile(profileRes)
        setLeaderboard(leaderboardRes)
      } catch (err) {
        console.error('Failed to load progress:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold mb-2">No progress data yet</h2>
            <p className="text-muted-foreground mb-4">Complete a challenge to see your progress</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Progress</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Streak */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Streak</h2>
          <StreakCalendar
            currentStreak={profile.streak.currentStreak}
            longestStreak={profile.streak.longestStreak}
            lastActiveDay={profile.streak.lastActiveDay}
          />
        </section>

        {/* Level & XP */}
        <section>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Level</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">{profile.level}</div>
                <p className="text-xs text-muted-foreground">Total XP: {profile.totalXp}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Challenges Completed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">{profile.profile.challengesCompleted}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Case Studies</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">{profile.profile.caseStudiesCompleted}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overall Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">{profile.profile.overallScore.toFixed(1)}</div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Skill Breakdown */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Skill Breakdown</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {profile.profile.skillBreakdown?.map((skill: any) => (
              <Card key={skill.skillId}>
                <CardHeader>
                  <CardTitle className="text-lg">{skill.skillName}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Progress value={skill.score} className="h-2 mb-2" />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Score</span>
                    <span className="font-medium">{skill.score.toFixed(1)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Leaderboard */}
        {leaderboard && (
          <section>
            <h2 className="text-xl font-semibold mb-4">Weekly Leaderboard</h2>
            <Card>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Weekly XP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaderboard.leaderboard.map((entry: any, index: number) => (
                      <TableRow key={entry.userId}>
                        <TableCell className="font-medium">{entry.rank}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback>{entry.email[0].toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span>{entry.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>{entry.weeklyXp}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {leaderboard.userRank && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm">
                      Your rank: <span className="font-medium">#{leaderboard.userRank.rank}</span> 
                      ({leaderboard.userRank.weeklyXp} XP this week)
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}
      </main>
    </div>
  )
}