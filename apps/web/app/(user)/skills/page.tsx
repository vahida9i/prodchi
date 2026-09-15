"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api-client"

type SkillNode = {
  id: string
  name: string
  order: number
  unlockThreshold: number | null
  gatedBySkillId: string | null
  score: number | null
  locked: boolean
}

type SkillCategoryWithSkills = {
  id: string
  name: string
  order: number
  skills: SkillNode[]
}

export default function SkillsPage() {
  const [categories, setCategories] = useState<SkillCategoryWithSkills[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSkills = async () => {
      try {
        // The tree, scores and lock state all come from the API: progression rules
        // live with the data (Skill.unlockThreshold), not in this component.
        const data = await api.getSkills()
        setCategories(data.categories)
      } catch (err) {
        console.error('Failed to load skill tree:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchSkills()
  }, [])

  const getSkillStatus = (skill: SkillNode) => {
    if (skill.locked) return 'locked'
    if (skill.score === null) return 'available'
    return 'in-progress'
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
          <h1 className="text-2xl font-bold">Skill Tree</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {categories.map((category) => (
          <section key={category.id}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">{category.name}</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {category.skills.map((skill) => {
                const status = getSkillStatus(skill)
                return (
                  <Card key={skill.id} className={status === 'locked' ? 'opacity-50' : ''}>
                    <CardHeader>
                      <CardTitle className="text-lg">{skill.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        {status === 'in-progress' && (
                          <Badge variant="success">In progress</Badge>
                        )}
                        {status === 'available' && (
                          <Badge variant="outline">Available</Badge>
                        )}
                        {status === 'locked' && (
                          <Badge variant="secondary">Locked</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {skill.score !== null && (
                        <div className="space-y-2">
                          <Progress value={skill.score} className="h-2" />
                          <p className="text-sm text-muted-foreground">Score: {skill.score.toFixed(0)}</p>
                        </div>
                      )}
                      {skill.locked && skill.unlockThreshold !== null && (
                        <p className="text-sm text-muted-foreground">
                          Unlock at {skill.unlockThreshold} in the previous skill
                        </p>
                      )}
                      {status === 'available' && (
                        <Button className="w-full mt-4" variant="outline">Start</Button>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}