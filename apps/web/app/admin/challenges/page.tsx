"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ChallengeImportForm } from "@/components/admin/ChallengeImportForm"
import { api } from "@/lib/api-client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function AdminChallengesPage() {
  const [draftChallenges, setDraftChallenges] = useState<any[]>([])
  const [publishedChallenges, setPublishedChallenges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('draft')

  useEffect(() => {
    const fetchChallenges = async () => {
      try {
        const [draftRes, publishedRes] = await Promise.all([
          api.getAdminChallenges('draft'),
          api.getAdminChallenges('published')
        ])
        setDraftChallenges(draftRes.challenges)
        setPublishedChallenges(publishedRes.challenges)
      } catch (err) {
        console.error('Failed to load challenges:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchChallenges()
  }, [])

  const handleStatusChange = async (id: string, status: 'draft' | 'published') => {
    try {
      await api.updateChallengeStatus(id, status)
      // Refresh
      const [draftRes, publishedRes] = await Promise.all([
        api.getAdminChallenges('draft'),
        api.getAdminChallenges('published')
      ])
      setDraftChallenges(draftRes.challenges)
      setPublishedChallenges(publishedRes.challenges)
    } catch (err: any) {
      alert(err.message || 'Failed to update status')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this challenge?')) return
    try {
      await api.deleteChallenge(id)
      // Refresh
      const [draftRes, publishedRes] = await Promise.all([
        api.getAdminChallenges('draft'),
        api.getAdminChallenges('published')
      ])
      setDraftChallenges(draftRes.challenges)
      setPublishedChallenges(publishedRes.challenges)
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Admin: Challenges</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Import Form */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Import New Challenge</h2>
          <ChallengeImportForm />
        </section>

        {/* Challenges List */}
        <section>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="draft">Draft ({draftChallenges.length})</TabsTrigger>
              <TabsTrigger value="published">Published ({publishedChallenges.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="draft">
              <Card>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Difficulty</TableHead>
                        <TableHead>XP</TableHead>
                        <TableHead>Skills</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {draftChallenges.map((challenge) => (
                        <TableRow key={challenge.id}>
                          <TableCell className="font-medium">{challenge.title}</TableCell>
                          <TableCell>
                            <Badge variant="outline">Level {challenge.difficulty}</Badge>
                          </TableCell>
                          <TableCell>{challenge.xpValue}</TableCell>
                          <TableCell>{challenge.skillIds.length} skills</TableCell>
                          <TableCell>{new Date(challenge.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => handleStatusChange(challenge.id, 'published')}>
                              Publish
                            </Button>
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(challenge.id)}>
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="published">
              <Card>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Difficulty</TableHead>
                        <TableHead>XP</TableHead>
                        <TableHead>Skills</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {publishedChallenges.map((challenge) => (
                        <TableRow key={challenge.id}>
                          <TableCell className="font-medium">{challenge.title}</TableCell>
                          <TableCell>
                            <Badge variant="outline">Level {challenge.difficulty}</Badge>
                          </TableCell>
                          <TableCell>{challenge.xpValue}</TableCell>
                          <TableCell>{challenge.skillIds.length} skills</TableCell>
                          <TableCell>{new Date(challenge.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => handleStatusChange(challenge.id, 'draft')}>
                              Unpublish
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </section>
      </main>
    </div>
  )
}