"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api } from "@/lib/api-client"

export default function AdminChallengeDetailPage() {
  const params = useParams()
  const challengeId = params.id as string
  const [challenge, setChallenge] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchChallenge = async () => {
      try {
        const data = await api.getAdminChallenge(challengeId)
        setChallenge(data)
      } catch (err) {
        console.error('Failed to load challenge:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchChallenge()
  }, [challengeId])

  const handleStatusChange = async (status: 'draft' | 'published') => {
    try {
      await api.updateChallengeStatus(challengeId, status)
      const data = await api.getAdminChallenge(challengeId)
      setChallenge(data)
    } catch (err: any) {
      alert(err.message || 'Failed to update status')
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this challenge?')) return
    try {
      await api.deleteChallenge(challengeId)
      window.location.href = '/admin/challenges'
    } catch (err: any) {
      alert(err.message || 'Failed to delete challenge')
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
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Admin: Challenge Detail</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{challenge.title}</CardTitle>
                <p className="text-muted-foreground">{challenge.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={difficultyColors[challenge.difficulty - 1] || difficultyColors[0]}>
                  Level {challenge.difficulty}
                </Badge>
                <Badge variant={challenge.status === 'published' ? 'success' : 'secondary'}>
                  {challenge.status}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-2">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {challenge.estimatedMinutes} minutes
              </span>
              <span className="flex items-center gap-2 text-primary">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                +{challenge.xpValue} XP
              </span>
              <span className="flex items-center gap-2">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {challenge.applicantSteps?.length || 0} steps
              </span>
              <span className="flex items-center gap-2">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Tier: {challenge.tier}
              </span>
            </div>

            <div className="flex gap-2">
              {challenge.status === 'draft' && (
                <Button onClick={() => handleStatusChange('published')}>Publish</Button>
              )}
              {challenge.status === 'published' && (
                <Button variant="outline" onClick={() => handleStatusChange('draft')}>Unpublish</Button>
              )}
              <Button variant="destructive" onClick={handleDelete}>Delete</Button>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="metadata" className="space-y-4">
          <TabsList>
            <TabsTrigger value="metadata">Metadata</TabsTrigger>
            <TabsTrigger value="hiddenCase">Hidden Case</TabsTrigger>
            <TabsTrigger value="applicantSteps">Applicant Steps</TabsTrigger>
            <TabsTrigger value="answerSheet">Answer Sheet</TabsTrigger>
          </TabsList>

          <TabsContent value="metadata">
            <Card>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm max-h-96">
                  {JSON.stringify({
                    title: challenge.title,
                    description: challenge.description,
                    estimatedMinutes: challenge.estimatedMinutes,
                    roleId: challenge.roleId,
                    difficulty: challenge.difficulty,
                    tier: challenge.tier,
                    xpValue: challenge.xpValue,
                    skillIds: challenge.skillIds
                  }, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="hiddenCase">
            <Card>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm max-h-96">
                  {JSON.stringify(challenge.hiddenCase, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="applicantSteps">
            <Card>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm max-h-96">
                  {JSON.stringify(challenge.applicantSteps, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="answerSheet">
            <Card>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm max-h-96">
                  {JSON.stringify(challenge.answerSheet, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}