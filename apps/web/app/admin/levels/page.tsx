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

const DIFFICULTY_LABELS: Record<string, string> = { easy: "آسان", medium: "متوسط", hard: "سخت" }

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
      alert("شماره، صنعت و سناریو را انتخاب کنید")
      return
    }
    setCreating(true)
    try {
      await api.createLevel({ number: Number(number), industryId, difficulty, challengeId })
      setNumber("")
      setChallengeId("")
      await refresh()
    } catch (err: any) {
      alert(err.message || "ساخت مرحله ناموفق بود")
    } finally {
      setCreating(false)
    }
  }

  const handleToggle = async (level: AdminLevel) => {
    try {
      await api.updateLevel(level.id, { status: level.status === "active" ? "retired" : "active" })
      await refresh()
    } catch (err: any) {
      alert(err.message || "به‌روزرسانی مرحله ناموفق بود")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("این مرحله حذف شود؟ تنها مرحله‌های بدون پیشرفت کاربر قابل حذف‌اند.")) return
    try {
      await api.deleteLevel(id)
      await refresh()
    } catch (err: any) {
      alert(err.message || "حذف مرحله ناموفق بود")
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
      alert(err.message || "ساخت صنعت ناموفق بود")
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
    router.push("/app/login")
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
          <h1 className="text-2xl font-bold">مدیریت مسیر مراحل</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push("/admin/challenges")}>
              Challenges
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              خروج
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <section className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">افزودن مرحله</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="level-number">شماره مرحله</Label>
                  <Input
                    id="level-number"
                    type="number"
                    min={1}
                    placeholder="مثلاً ۳"
                    value={number}
                    onChange={event => setNumber(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>سختی</Label>
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DIFFICULTIES.map(option => (
                        <SelectItem key={option} value={option} className="capitalize">{DIFFICULTY_LABELS[option]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>صنعت</Label>
                <Select value={industryId} onValueChange={setIndustryId}>
                  <SelectTrigger><SelectValue placeholder="صنعت را انتخاب کنید" /></SelectTrigger>
                  <SelectContent>
                    {industries.map(industry => (
                      <SelectItem key={industry.id} value={industry.id}>{industry.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>سناریوی بارگذاری‌شده و بدون مرحله</Label>
                <Select value={challengeId} onValueChange={setChallengeId}>
                  <SelectTrigger><SelectValue placeholder="سناریو را انتخاب کنید" /></SelectTrigger>
                  <SelectContent>
                    {unassigned.length === 0 ? (
                      <SelectItem value="none" disabled>سناریوی بدون مرحله‌ای وجود ندارد</SelectItem>
                    ) : (
                      unassigned.map(challenge => (
                        <SelectItem key={challenge.id} value={challenge.id}>
                          {challenge.title} ({challenge.type === "single_question" ? "تصمیم سریع" : "سناریو"})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handleCreateLevel} disabled={creating}>
                {creating ? "در حال ساخت…" : "ساخت مرحله"}
              </Button>
              <p className="text-xs text-muted-foreground">
                نوع مرحله از ساختار سؤال‌های سناریو تعیین می‌شود.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">صنایع</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {industries.map(industry => (
                  <div key={industry.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{industry.name}</span>
                    <span className="text-muted-foreground">{industry.levelCount.toLocaleString("fa-IR")} مرحله</span>
                  </div>
                ))}
                {industries.length === 0 && (
                  <p className="text-sm text-muted-foreground">هنوز صنعتی ثبت نشده است.</p>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="نام صنعت جدید"
                  value={industryName}
                  onChange={event => setIndustryName(event.target.value)}
                />
                <Button variant="outline" onClick={handleCreateIndustry} disabled={creatingIndustry}>
                  {creatingIndustry ? "در حال افزودن…" : "افزودن"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">مسیر مراحل</h2>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>سناریو</TableHead>
                    <TableHead>صنعت</TableHead>
                    <TableHead>سختی</TableHead>
                    <TableHead>بازیکنان</TableHead>
                    <TableHead className="text-right">وضعیت و عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {levels.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        هنوز مرحله‌ای ثبت نشده است؛ از فرم بالا یک سناریو اضافه کنید.
                      </TableCell>
                    </TableRow>
                  ) : (
                    levels.map(level => (
                      <TableRow key={level.id}>
                        <TableCell className="font-bold">{level.number.toLocaleString("fa-IR")}</TableCell>
                        <TableCell>
                          <p className="font-medium">{level.challenge.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {level.type === "single_question" ? "تصمیم سریع" : "سناریو"}
                          </p>
                        </TableCell>
                        <TableCell>{level.industry.name}</TableCell>
                        <TableCell className="capitalize">{DIFFICULTY_LABELS[level.difficulty as "easy" | "medium" | "hard"] ?? level.difficulty}</TableCell>
                        <TableCell>{level.playerCount.toLocaleString("fa-IR")}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Badge variant={level.status === "active" ? "default" : "secondary"} className="mr-2">
                            {level.status === "active" ? "فعال" : "بازنشسته"}
                          </Badge>
                          <Button variant="outline" size="sm" onClick={() => handleToggle(level)}>
                            {level.status === "active" ? "بازنشسته‌کردن" : "فعال‌سازی"}
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(level.id)}>
                            حذف
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