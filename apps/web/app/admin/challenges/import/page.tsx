"use client"

import { ChallengeImportForm } from "@/components/admin/ChallengeImportForm"

export default function AdminChallengeImportPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Admin: Import Challenge</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <ChallengeImportForm />
      </main>
    </div>
  )
}