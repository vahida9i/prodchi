"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { api } from "@/lib/api-client"
import { ValidationErrorList } from "@/components/admin/ValidationErrorList"

interface ChallengeImportFormProps {
  onImported?: () => void
}

interface FieldError {
  path: string
  message: string
}

/**
 * Paste-only challenge import (plan Feature 1): the JSON is parsed client-side
 * for instant syntax feedback, then validated server-side. Structural and flow
 * failures come back as itemized reasons — the app never guesses or repairs.
 */
export function ChallengeImportForm({ onImported }: ChallengeImportFormProps) {
  const [jsonInput, setJsonInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<FieldError[]>([])
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors([])
    setSuccess(null)
    setIsLoading(true)

    try {
      const data = JSON.parse(jsonInput)
      const response = await api.importChallenge(data)
      setSuccess(
        response.updated
          ? "سناریو به‌روزرسانی شد و محتوای جدید فعال است. امتیاز نشست‌های گذشته حفظ می‌شود."
          : "سناریو بارگذاری و در فهرست فعال شد."
      )
      setJsonInput('')
      onImported?.()
    } catch (error: any) {
      if (error instanceof SyntaxError) {
        setErrors([{ path: 'json', message: `ساختار JSON نامعتبر است: ${error.message}` }])
      } else if (error?.errors?.length) {
        // Import-style failures: itemized `{ path, message }` reasons on the
        // ApiError itself (see api-client).
        setErrors(error.errors)
      } else if (error?.details?.errors) {
        setErrors(error.details.errors)
      } else {
        setErrors([{ path: 'root', message: error.message || 'بارگذاری سناریو ناموفق بود' }])
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>بارگذاری سناریو</CardTitle>
        <CardDescription>
          JSON سناریو را وارد کنید. ساختار و مسیر سؤال‌ها بررسی می‌شود و خطاها به‌صورت دقیق نمایش داده می‌شوند. سناریوی جدید بلافاصله فعال می‌شود و ورود دوبارهٔ شناسهٔ قبلی، آن را به‌روزرسانی می‌کند.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="json-input">JSON سناریو</Label>
            <Textarea
              id="json-input"
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              className="font-mono text-sm min-h-[300px]"
              placeholder={'{\n  "id": "onboarding_drop_off",\n  "title": "جستجوی بی‌نتیجه",\n  "role": "Product Design",\n  "difficulty": "medium",\n  "start": "Q1",\n  "questions": { "Q1": { "text": "...", "choices": [ ... ] }, ... }\n}'}
            />
          </div>

          <ValidationErrorList errors={errors} />

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
              {success}
            </div>
          )}

          <Button type="submit" disabled={isLoading || jsonInput.trim() === ''}>
            {isLoading ? 'در حال بررسی…' : 'بارگذاری سناریو'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}