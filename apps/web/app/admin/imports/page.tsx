"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { api } from "@/lib/api-client"
import { ValidationErrorList } from "@/components/admin/ValidationErrorList"

type FailedImports = Awaited<ReturnType<typeof api.getFailedImports>>["failedImports"]

/**
 * Failed import history (plan Feature 5): every rejected import with the
 * itemized reasons it was rejected, so the admin can fix the source and
 * re-import.
 */
export default function AdminFailedImportsPage() {
  const [failedImports, setFailedImports] = useState<FailedImports>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getFailedImports()
      .then(res => setFailedImports(res.failedImports))
      .catch(err => console.error("Failed to load import history:", err))
      .finally(() => setLoading(false))
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
          <h1 className="text-2xl font-bold">Admin: Failed Imports</h1>
          <Link href="/admin/challenges">
            <Button variant="ghost" size="sm">← Challenges</Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-4">
        {failedImports.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No failed imports. Clean record!</p>
            </CardContent>
          </Card>
        ) : (
          failedImports.map((failed) => (
            <Card key={failed.id}>
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{failed.summary.title || "Untitled payload"}</p>
                    <p className="text-muted-foreground">
                      {failed.summary.id ? (
                        <>id: <code>{failed.summary.id}</code> · </>
                      ) : null}
                      {failed.summary.questionCount !== null
                        ? `${failed.summary.questionCount} question(s) parsed`
                        : "payload was not a challenge object"}
                    </p>
                  </div>
                  <span className="text-muted-foreground whitespace-nowrap">
                    {new Date(failed.createdAt).toLocaleString()}
                  </span>
                </div>
                <ValidationErrorList errors={failed.errors} />
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  )
}