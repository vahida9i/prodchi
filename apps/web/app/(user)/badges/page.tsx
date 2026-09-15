"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BadgeGrid } from "@/components/challenge/BadgeGrid"
import { api } from "@/lib/api-client"

export default function BadgesPage() {
  const [badges, setBadges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBadges = async () => {
      try {
        const data = await api.getBadges()
        setBadges(data.badges)
      } catch (err) {
        console.error('Failed to load badges:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchBadges()
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
          <h1 className="text-2xl font-bold">Badges</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Your Badge Collection</CardTitle>
          </CardHeader>
          <CardContent>
            <BadgeGrid badges={badges} />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}