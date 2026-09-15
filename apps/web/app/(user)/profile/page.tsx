"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { RadarChart } from "@/components/challenge/RadarChart"
import { api } from "@/lib/api-client"

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await api.getProfile().catch(() => null)
        setProfile(data)
      } catch (err) {
        console.error('Failed to load profile:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
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
          <CardContent className="py-12 text-center max-w-md">
            <h2 className="text-xl font-semibold mb-2">No profile data yet</h2>
            <p className="text-muted-foreground mb-6">Complete a challenge to see your capability profile</p>
            <Button variant="link" onClick={() => window.location.href = '/home'}>Browse Challenges</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Capability Profile</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
        {/* Profile Header */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <Avatar className="h-24 w-24">
                <AvatarFallback className="text-3xl">U</AvatarFallback>
              </Avatar>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-3xl font-bold">Product Designer</h2>
                <p className="text-muted-foreground">Level {profile.level} • {profile.totalXp} XP</p>
                <div className="flex items-center justify-center md:justify-start gap-4 mt-4">
                  <Badge variant="secondary">Challenges: {profile.profile.challengesCompleted}</Badge>
                  <Badge variant="secondary">Case Studies: {profile.profile.caseStudiesCompleted}</Badge>
                  <Badge variant="outline">Overall: {profile.profile.overallScore.toFixed(1)}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{profile.streak.currentStreak}</div>
                  <div className="text-sm text-muted-foreground">Day Streak</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{profile.streak.longestStreak}</div>
                  <div className="text-sm text-muted-foreground">Longest</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Radar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Skill Radar</CardTitle>
          </CardHeader>
          <CardContent>
            <RadarChart data={profile.profile.skillBreakdown} />
          </CardContent>
        </Card>

        {/* Skill Details */}
        <Card>
          <CardHeader>
            <CardTitle>Skill Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {profile.profile.skillBreakdown?.map((skill: any) => (
                <div key={skill.skillId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{skill.skillName}</span>
                    <span className="text-lg font-bold">{skill.score.toFixed(1)}</span>
                  </div>
                  <Progress value={skill.score} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Badges */}
        {profile.badges.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Badges</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {profile.badges.slice(0, 6).map((badge: any) => (
                  <Badge key={badge.id} variant="outline" className="gap-1">
                    {badge.iconRef} {badge.name}
                  </Badge>
                ))}
                {profile.badges.length > 6 && (
                  <Badge variant="secondary">+{profile.badges.length - 6} more</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}