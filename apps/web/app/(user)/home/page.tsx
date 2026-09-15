"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { api } from "@/lib/api-client"
import { ChallengeCard } from "@/components/challenge/ChallengeCard"
import { StreakCalendar } from "@/components/challenge/StreakCalendar"

export default function HomePage() {
  const [challenges, setChallenges] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [challengesRes, profileRes] = await Promise.all([
          api.getChallenges('free'),
          api.getProfile().catch(() => null)
        ])
        setChallenges(challengesRes.challenges)
        setProfile(profileRes)
      } catch (err) {
        console.error('Failed to load home data:', err)
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Baaten</h1>
          <div className="flex items-center gap-4">
            {profile && (
              <>
                <div className="hidden md:flex items-center gap-2">
                  <Badge variant="secondary">Level {profile.level}</Badge>
                  <Badge variant="outline">XP: {profile.totalXp}</Badge>
                </div>
                <Avatar className="h-8 w-8">
                  <AvatarFallback>U</AvatarFallback>
                </Avatar>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Streak & Profile Summary */}
        {profile && (
          <section>
            <h2 className="text-xl font-semibold mb-4">Your Progress</h2>
            <StreakCalendar
              currentStreak={profile.streak.currentStreak}
              longestStreak={profile.streak.longestStreak}
              lastActiveDay={profile.streak.lastActiveDay}
            />
          </section>
        )}

        {/* Available Challenges */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Available Challenges</h2>
            <Link href="/skills">
              <Button variant="ghost" size="sm">View Skill Tree</Button>
            </Link>
          </div>
          {challenges.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No challenges available yet. Check back soon!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {challenges.map((challenge) => (
                <ChallengeCard key={challenge.id} challenge={challenge} onClick={() => {}} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}