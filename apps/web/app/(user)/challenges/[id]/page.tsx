"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api-client"

export default function ChallengeIntroPage() {
  const params = useParams()
  const router = useRouter()
  const challengeId = params.id as string
  const [challenge, setChallenge] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    const fetchChallenge = async () => {
      try {
        const data = await api.getChallenge(challengeId)
        setChallenge(data)
      } catch (err) {
        console.error('Failed to load challenge:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchChallenge()
  }, [challengeId])

  const handleStart = async () => {
    setStarting(true)
    try {
      const attempt = await api.createAttempt(challengeId)
      router.push(`/attempts/${attempt.attemptId}`)
    } catch (err: any) {
      // Session expired/missing: send the user to login instead of dead-ending.
      if (err?.status === 401) {
        router.push('/login')
        return
      }
      alert(err.message || 'Failed to start challenge')
    } finally {
      setStarting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!challenge) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold mb-2">Challenge not found</h2>
            <Button variant="link" onClick={() => window.history.back()}>Go back</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const difficultyColors = [
    'bg-green-100 text-green-800',
    'bg-blue-100 text-blue-800',
    'bg-yellow-100 text-yellow-800',
    'bg-orange-100 text-orange-800',
    'bg-red-100 text-red-800'
  ]

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Baaten</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{challenge.title}</CardTitle>
                <CardDescription>{challenge.description}</CardDescription>
              </div>
              <Badge variant="outline" className={difficultyColors[challenge.difficulty - 1] || difficultyColors[0]}>
                Level {challenge.difficulty}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{challenge.estimatedMinutes} minutes</span>
              </div>
              <div className="flex items-center gap-2 text-primary">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span>+{challenge.xpValue} XP</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>{challenge.applicantSteps?.length || 0} steps</span>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h3 className="font-semibold mb-3">What you'll practice</h3>
              <p className="text-muted-foreground">
                This challenge covers multiple product design skills. You'll work through a realistic scenario,
                making decisions at each step. Your choices will be assessed by AI to provide personalized feedback
                and update your skill scores.
              </p>
            </div>

            <Button onClick={handleStart} disabled={starting} className="w-full" size="lg">
              {starting ? 'Starting...' : 'Start Challenge'}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}