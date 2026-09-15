"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useState } from "react"
import { api } from "@/lib/api-client"

interface ValidationError {
  path: string
  message: string
}

export function ChallengeImportForm() {
  const [jsonInput, setJsonInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<ValidationError[]>([])
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors([])
    setSuccess(null)
    setIsLoading(true)

    try {
      const data = JSON.parse(jsonInput)
      const response = await api.importChallenge(data)
      setSuccess(`Challenge imported successfully! ID: ${response.challengeId}`)
      setJsonInput('')
    } catch (error: any) {
      if (error.details?.errors) {
        setErrors(error.details.errors)
      } else {
        setErrors([{ path: 'root', message: error.message || 'Import failed' }])
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setJsonInput(event.target?.result as string)
      }
      reader.readAsText(file)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Challenge</CardTitle>
        <CardDescription>
          Paste a challenge JSON or upload a .json file. The validator will check structure and references.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="json-file">Upload JSON File</Label>
            <input
              id="json-file"
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
            />
            <p className="text-xs text-muted-foreground">Or paste JSON below</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="json-input">Challenge JSON</Label>
            <Textarea
              id="json-input"
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              className="font-mono text-sm min-h-[300px]"
              placeholder='{
  "metadata": {
    "title": "string",
    "description": "string",
    "estimatedMinutes": 15,
    "roleId": "uuid",
    "difficulty": 2,
    "tier": "free",
    "xpValue": 120,
    "skillIds": ["uuid"]
  },
  "hiddenCase": { ... },
  "applicantSteps": [...],
  "answerSheet": [...]
}'
            />
          </div>

          {errors.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="destructive">Validation Errors ({errors.length})</Badge>
              </div>
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 max-h-60 overflow-y-auto">
                <ul className="space-y-1 text-sm">
                  {errors.map((error, index) => (
                    <li key={index} className="flex gap-2 text-destructive">
                      <code className="bg-background px-1 rounded">{error.path}</code>
                      <span>{error.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
              {success}
            </div>
          )}

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? 'Importing...' : 'Import Challenge'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}