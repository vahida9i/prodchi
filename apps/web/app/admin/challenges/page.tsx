"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ChallengeImportForm } from "@/components/admin/ChallengeImportForm"
import { api } from "@/lib/api-client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type AdminChallenge = Awaited<ReturnType<typeof api.getAdminChallenges>>["challenges"][number]

/**
 * Admin challenge management (plan Features 1 + 5): import, library list with
 * active/retired status, retire/restore, and delete (server blocks deletion
 * when sessions exist).
 */
export default function AdminChallengesPage() {
  const router = useRouter()
  const [active, setActive] = useState<AdminChallenge[]>([])
  const [retired, setRetired] = useState<AdminChallenge[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const [activeRes, retiredRes] = await Promise.all([
      api.getAdminChallenges("active"),
      api.getAdminChallenges("retired")
    ])
    setActive(activeRes.challenges)
    setRetired(retiredRes.challenges)
  }, [])

  useEffect(() => {
    refresh()
      .catch(err => console.error("Failed to load challenges:", err))
      .finally(() => setLoading(false))
  }, [refresh])

  const handleToggle = async (challenge: AdminChallenge) => {
    try {
      await api.updateChallengeStatus(
        challenge.id,
        challenge.status === "active" ? "retired" : "active"
      )
      await refresh()
    } catch (err: any) {
      alert(err.message || "Failed to update status")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this challenge? Deletion is only possible for challenges without sessions.")) return
    try {
      await api.deleteChallenge(id)
      await refresh()
    } catch (err: any) {
      alert(err.message || "Failed to delete challenge")
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

  const renderRows = (rows: AdminChallenge[], tab: "active" | "retired") => {
    if (rows.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
            No {tab} challenges.
          </TableCell>
        </TableRow>
      )
    }
    return rows.map((challenge) => (
      <TableRow key={challenge.id}>
        <TableCell className="font-medium">{challenge.title}</TableCell>
        <TableCell className="capitalize">{challenge.difficulty}</TableCell>
        <TableCell>
          <code className="text-xs">{challenge.importKey}</code>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {new Date(challenge.createdAt).toLocaleDateString()}
        </TableCell>
        <TableCell className="text-right space-x-2">
          <Badge variant={challenge.status === "active" ? "default" : "secondary"} className="mr-2">
            {challenge.status}
          </Badge>
          <Link href={`/admin/challenges/${challenge.id}`}>
            <Button variant="outline" size="sm">View</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => handleToggle(challenge)}>
            {tab === "active" ? "Retire" : "Restore"}
          </Button>
          <Button variant="destructive" size="sm" onClick={() => handleDelete(challenge.id)}>
            Delete
          </Button>
        </TableCell>
      </TableRow>
    ))
  }

  const renderTable = (rows: AdminChallenge[], tab: "active" | "retired") => (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Difficulty</TableHead>
              <TableHead>Import key</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Status &amp; actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{renderRows(rows, tab)}</TableBody>
        </Table>
      </CardContent>
    </Card>
  )

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
          <div className="flex items-center gap-2">
            <Link href="/admin/levels">
              <Button variant="outline" size="sm">Levels</Button>
            </Link>
            <Link href="/admin/imports">
              <Button variant="outline" size="sm">Failed imports</Button>
            </Link>
            <Button variant="outline" size="sm" onClick={handleLogout}>Log out</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <section>
          <h2 className="text-xl font-semibold mb-4">Import New Challenge</h2>
          <ChallengeImportForm onImported={refresh} />
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Challenge Library</h2>
          <Tabs defaultValue="active">
            <TabsList>
              <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
              <TabsTrigger value="retired">Retired ({retired.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="active">{renderTable(active, "active")}</TabsContent>
            <TabsContent value="retired">{renderTable(retired, "retired")}</TabsContent>
          </Tabs>
        </section>
      </main>
    </div>
  )
}