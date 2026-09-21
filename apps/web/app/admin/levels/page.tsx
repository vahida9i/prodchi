"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api-client"

type AdminLevel = Awaited<ReturnType<typeof api.getAdminLevels>>["levels"][number]
type UnassignedChallenge = Awaited<ReturnType<typeof api.getUnassignedChallenges>>["challenges"][number]
type Industry = Awaited<ReturnType<typeof api.getIndustries>>["industries"][number]

const DIFFICULTIES = ["easy", "medium", "hard"] as const

/**
 * Admin management of the level path: assign an imported (and still
 * unassigned) challenge to a numbered level + industry, retire/restore,
 * delete (blocked once anyone has progress), and manage industries.
 */
export default function AdminLevelsPage() {
  const router = useRouter()
  const [levels, setLevels] = useState<AdminLevel[]>([])
  const [industries, setIndustries] = useState<Industry[]>([])
  const [unassigned, setUnassigned] = useState<UnassignedChallenge[]>([])
  const [loading, setLoading] = useState(true)
  const [number, setNumber] = useState("")
  const [industryId, setIndustryId] = useState("")
  const [difficulty, setDifficulty] = useState<string>("medium")
  const [challengeId, setChallengeId] = useState("")
  const [creating, setCreating] = useState(false)
  const [industryName, setIndustryName] = useState("")
  const [creatingIndustry, setCreatingIndustry] = useState(false)

  const refresh = useCallback(async () => {
    const [levelsRes, industriesRes, unassignedRes] = await Promise.all([
      api.getAdminLevels(),
      api.getIndustries(),
      api.getUnassignedChallenges()
    ])
    setLevels(levelsRes.levels)
    setIndustries(industriesRes.industries)
    setUnassigned(unassignedRes.challenges)
  }, [])

  useEffect(() => {
    refresh()
      .catch(err => console.error("Failed to load levels:", err))
      .finally(() => setLoading(false))
  }, [refresh])

  const handleCreateLevel = async () => {
    if (!number || !industryId || !challengeId) {
      alert("Pick a number, an industry and a challenge")
      return
    }
    setCreating(true)
    try {
      await api.createLevel({ number: Number(number), industryId, difficulty, challengeId })
      setNumber("")
      setChallengeId("")
      await refresh()
    } catch (err: any) {
      alert(err.message || "Failed to create level")
    } finally {
      setCreating(false)
    }
  }

  const handleToggle = async (level: AdminLevel) => {
    try {
      await api.updateLevel(level.id, { status: level.status === "active" ? "retired" : "active" })
      await refresh()
    } catch (err: any) {
      alert(err.message || "Failed to update level")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this level? Only possible when no one has progress on it.")) return
    try {
      await api.deleteLevel(id)
      await refresh()
    } catch (err: any) {
      alert(err.message || "Failed to delete level")
    }
  }

  const handleCreateIndustry = async () => {
    if (!industryName.trim()) return
    setCreatingIndustry(true)
    try {
      await api.createIndustry(industryName.trim(), industries.length)
      setIndustryName("")
      await refresh()
    } catch (err: any) {
      alert(err.message || "Failed to create industry")
    } finally {
      setCreatingIndustry(false)
    }
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
          <h1 className="text-2xl font-bold">Admin: Level Path</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push("/admin/challenges")}>
              Challenges
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Log out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <section className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Assign a level</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="level-number">Level number</Label>
                  <Input
                    id="level-number"
                    type="number"
                    min={1}
                    placeholder="e.g. 3"
                    value={number}
                    onChange={event => setNumber(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Difficulty</Label>
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DIFFICULTIES.map(option => (
                        <SelectItem key={option} value={option} className="capitalize">{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Industry</Label>
                <Select value={industryId} onValueChange={setIndustryId}>
                  <SelectTrigger><SelectValue placeholder="Pick an industry" /></SelectTrigger>
                  <SelectContent>
                    {industries.map(industry => (
                      <SelectItem key={industry.id} value={industry.id}>{industry.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Challenge (imported, unassigned)</Label>
                <Select value={challengeId} onValueChange={setChallengeId}>
                  <SelectTrigger><SelectValue placeholder="Pick a challenge" /></SelectTrigger>
                  <SelectContent>
                    {unassigned.length === 0 ? (
                      <SelectItem value="none" disabled>No unassigned challenges</SelectItem>
                    ) : (
                      unassigned.map(challenge => (
                        <SelectItem key={challenge.id} value={challenge.id}>
                          {challenge.title} ({challenge.type === "single_question" ? "quick call" : "scenario"})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handleCreateLevel} disabled={creating}>
                {creating ? "Creating…" : "Create level"}
              </Button>
              <p className="text-xs text-muted-foreground">
                The type (scenario vs quick call) is derived from the challenge graph — it cannot be set by hand.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Industries</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {industries.map(industry => (
                  <div key={industry.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{industry.name}</span>
                    <span className="text-muted-foreground">{industry.levelCount} level{industry.levelCount === 1 ? "" : "s"}</span>
                  </div>
                ))}
                {industries.length === 0 && (
                  <p className="text-sm text-muted-foreground">No industries yet.</p>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="New industry name"
                  value={industryName}
                  onChange={event => setIndustryName(event.target.value)}
                />
                <Button variant="outline" onClick={handleCreateIndustry} disabled={creatingIndustry}>
                  {creatingIndustry ? "Adding…" : "Add"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Level path</h2>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>Challenge</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Players</TableHead>
                    <TableHead className="text-right">Status &amp; actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {levels.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No levels yet — assign a challenge above.
                      </TableCell>
                    </TableRow>
                  ) : (
                    levels.map(level => (
                      <TableRow key={level.id}>
                        <TableCell className="font-bold">{level.number}</TableCell>
                        <TableCell>
                          <p className="font-medium">{level.challenge.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {level.type === "single_question" ? "Quick call" : "Scenario"}
                          </p>
                        </TableCell>
                        <TableCell>{level.industry.name}</TableCell>
                        <TableCell className="capitalize">{level.difficulty}</TableCell>
                        <TableCell>{level.playerCount}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Badge variant={level.status === "active" ? "default" : "secondary"} className="mr-2">
                            {level.status}
                          </Badge>
                          <Button variant="outline" size="sm" onClick={() => handleToggle(level)}>
                            {level.status === "active" ? "Retire" : "Restore"}
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(level.id)}>
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}