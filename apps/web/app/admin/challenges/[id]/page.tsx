"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { RevealBlock } from "@/components/challenge/RevealBlock"
import { api } from "@/lib/api-client"
import { cn } from "@/lib/utils"

const DIFFICULTY_LABELS: Record<string, string> = { easy: "آسان", medium: "متوسط", hard: "سخت" }

type Detail = Awaited<ReturnType<typeof api.getAdminChallenge>>

/**
 * Full internal challenge view for admins: metadata plus every question with
 * its choices, stage labels, reveals, and next pointers. This is internal
 * authoring scaffolding — candidates never see any of it.
 */
export default function AdminChallengeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editJson, setEditJson] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveState, setSaveState] = useState<{ kind: "ok" | "err"; message: string } | null>(null)

  const load = useCallback(async () => {
    try {
      setDetail(await api.getAdminChallenge(id))
    } catch (err: any) {
      setError(err.message || "بارگذاری سناریو ناموفق بود")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const toggleStatus = async () => {
    if (!detail) return
    try {
      await api.updateChallengeStatus(id, detail.status === "active" ? "retired" : "active")
      await load()
    } catch (err: any) {
      alert(err.message || "تغییر وضعیت ناموفق بود")
    }
  }

  /**
   * Editing is a re-import: the internal view is a valid import payload (the API
   * returns the role name for exactly this), so an update goes through the same
   * deterministic validator as a first import and never needs a delete.
   */
  const startEditing = () => {
    if (!detail) return
    setSaveState(null)
    setEditJson(JSON.stringify({
      id: detail.importKey,
      title: detail.title,
      role: detail.role,
      difficulty: detail.difficulty,
      start: detail.startKey,
      questions: detail.questions
    }, null, 2))
  }

  const saveUpdate = async () => {
    if (!editJson) return
    setSaving(true)
    setSaveState(null)
    try {
      await api.importChallenge(JSON.parse(editJson))
      setEditJson(null)
      await load()
      setSaveState({ kind: "ok", message: "سناریو به‌روزرسانی شد و برای نشست‌های جدید فعال است." })
    } catch (err: any) {
      if (err instanceof SyntaxError) {
        setSaveState({ kind: "err", message: `ساختار JSON نامعتبر است: ${err.message}` })
      } else if (err?.errors?.length) {
        setSaveState({
          kind: "err",
          message: err.errors.map((e: { path: string; message: string }) => `${e.path}: ${e.message}`).join(" · ")
        })
      } else {
        setSaveState({ kind: "err", message: err.message || "به‌روزرسانی ناموفق بود" })
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold mb-2">{error || "سناریو پیدا نشد"}</h2>
            <Button variant="link" onClick={() => router.push("/admin/challenges")}>بازگشت به سناریوها</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const questions = Object.entries(detail.questions)

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/challenges">
              <Button variant="ghost" size="sm">بازگشت به سناریوها</Button>
            </Link>
            <h1 className="text-2xl font-bold">{detail.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={detail.status === "active" ? "default" : "secondary"}>{detail.status === "active" ? "فعال" : "بازنشسته"}</Badge>
            <Button variant="outline" size="sm" onClick={startEditing}>
              ویرایش محتوا
            </Button>
            <Button variant="outline" size="sm" onClick={toggleStatus}>
              {detail.status === "active" ? "بازنشسته‌کردن" : "فعال‌سازی"}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">جزئیات</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p><span className="text-muted-foreground">شناسه ورود:</span> <code>{detail.importKey}</code></p>
            <p><span className="text-muted-foreground">سختی:</span> <span className="capitalize">{DIFFICULTY_LABELS[detail.difficulty as "easy" | "medium" | "hard"] ?? detail.difficulty}</span></p>
            <p><span className="text-muted-foreground">سؤال آغازین:</span> <code>{detail.startKey}</code></p>
            <p><span className="text-muted-foreground">تعداد سؤال‌ها:</span> {questions.length.toLocaleString("fa-IR")}</p>
            <p className="text-muted-foreground">
              بارگذاری: {new Date(detail.createdAt).toLocaleString("fa-IR")} · به‌روزرسانی: {new Date(detail.updatedAt).toLocaleString("fa-IR")}
            </p>
          </CardContent>
        </Card>

        {saveState && (
          <div className={cn(
            "rounded-lg border p-3 text-sm",
            saveState.kind === "ok"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-destructive/10 border-destructive/20 text-destructive"
          )}>
            {saveState.message}
          </div>
        )}

        {editJson !== null && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">ویرایش محتوا</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                JSON را ویرایش و ذخیره کنید. اعتبارسنجی دوباره انجام می‌شود؛ امتیاز نشست‌های پایان‌یافته حفظ و نشست‌های در حال اجرا متوقف می‌شوند.
              </p>
              <Textarea
                value={editJson}
                onChange={(e) => setEditJson(e.target.value)}
                className="font-mono text-sm min-h-[400px]"
              />
              <div className="flex gap-2">
                <Button onClick={saveUpdate} disabled={saving}>
                  {saving ? "در حال ذخیره…" : "ذخیره تغییرات"}
                </Button>
                <Button variant="outline" onClick={() => setEditJson(null)} disabled={saving}>
                  انصراف
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">سؤال‌ها (نمای مدیر)</h2>
          {questions.map(([key, q]) => (
            <div key={key} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <code className="bg-muted px-2 py-0.5 rounded text-sm">{key}</code>
                {key === detail.startKey && <Badge>آغاز</Badge>}
                <Badge variant="secondary">پاسخ برتر: گزینه {(q.bestChoice + 1).toLocaleString("fa-IR")}</Badge>
              </div>
              <p className="font-medium leading-relaxed">{q.text}</p>
              <ul className="space-y-2">
                {q.choices.map((choice, i) => (
                  <li key={i} className={cn("rounded-md p-3 text-sm space-y-1", q.bestChoice === i ? "bg-primary/5 border border-primary/30" : "bg-muted/50")}>
                    <p className="font-medium">
                      {choice.text}
                      {q.bestChoice === i && <Badge className="ml-2">برتر</Badge>}
                    </p>
                    <p>
                      <Badge variant="outline">{choice.stage}</Badge>
                    </p>
                    <div className="space-y-1 text-muted-foreground">
                      <p className="italic">پیامد انتخاب:</p>
                      <RevealBlock reveal={choice.reveal} variant="compact" />
                    </div>
                    <p className="text-muted-foreground">
                      بعدی: {choice.next === "END" ? "پایان نشست" : <code>{choice.next}</code>}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}