"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api-client"

interface SkillCategoryWithSkills {
  id: string
  name: string
  order: number
  skills: Array<{
    id: string
    name: string
    order: number
    unlockThreshold: number | null
    score?: number
  }>
}

export default function SkillsPage() {
  const [categories, setCategories] = useState<SkillCategoryWithSkills[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const profileRes = await api.getProfile().catch(() => null)
        setProfile(profileRes)

        setCategories([
          {
            id: 'research',
            name: 'Research & Discovery',
            order: 0,
            skills: [
              { id: 'user-research', name: 'User Research', order: 0, unlockThreshold: null, score: profileRes?.profile?.skillBreakdown?.find((s: any) => s.skillId === 'user-research')?.score },
              { id: 'competitive-analysis', name: 'Competitive Analysis', order: 1, unlockThreshold: 40, score: profileRes?.profile?.skillBreakdown?.find((s: any) => s.skillId === 'competitive-analysis')?.score },
              { id: 'data-analysis', name: 'Quantitative Data Analysis', order: 2, unlockThreshold: 50, score: profileRes?.profile?.skillBreakdown?.find((s: any) => s.skillId === 'data-analysis')?.score }
            ]
          },
          {
            id: 'strategy',
            name: 'Strategy & Prioritization',
            order: 1,
            skills: [
              { id: 'problem-framing', name: 'Problem Framing', order: 0, unlockThreshold: null, score: profileRes?.profile?.skillBreakdown?.find((s: any) => s.skillId === 'problem-framing')?.score },
              { id: 'roadmapping', name: 'Roadmapping & Prioritization', order: 1, unlockThreshold: 40, score: profileRes?.profile?.skillBreakdown?.find((s: any) => s.skillId === 'roadmapping')?.score },
              { id: 'metrics-definition', name: 'Metrics Definition', order: 2, unlockThreshold: 50, score: profileRes?.profile?.skillBreakdown?.find((s: any) => s.skillId === 'metrics-definition')?.score }
            ]
          },
          {
            id: 'design',
            name: 'Interaction & Visual Design',
            order: 2,
            skills: [
              { id: 'wireframing', name: 'Wireframing & Prototyping', order: 0, unlockThreshold: null, score: profileRes?.profile?.skillBreakdown?.find((s: any) => s.skillId === 'wireframing')?.score },
              { id: 'visual-design', name: 'Visual Design Systems', order: 1, unlockThreshold: 40, score: profileRes?.profile?.skillBreakdown?.find((s: any) => s.skillId === 'visual-design')?.score },
              { id: 'interaction-design', name: 'Interaction Design', order: 2, unlockThreshold: 50, score: profileRes?.profile?.skillBreakdown?.find((s: any) => s.skillId === 'interaction-design')?.score }
            ]
          },
          {
            id: 'validation',
            name: 'Validation & Iteration',
            order: 3,
            skills: [
              { id: 'usability-testing', name: 'Usability Testing', order: 0, unlockThreshold: null, score: profileRes?.profile?.skillBreakdown?.find((s: any) => s.skillId === 'usability-testing')?.score },
              { id: 'ab-testing', name: 'A/B Testing & Experimentation', order: 1, unlockThreshold: 40, score: profileRes?.profile?.skillBreakdown?.find((s: any) => s.skillId === 'ab-testing')?.score },
              { id: 'iteration', name: 'Iteration & Learning Loops', order: 2, unlockThreshold: 50, score: profileRes?.profile?.skillBreakdown?.find((s: any) => s.skillId === 'iteration')?.score }
            ]
          }
        ])
      } catch (err) {
        console.error('Failed to load skills:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const getSkillStatus = (skill: any) => {
    if (skill.score === undefined) {
      if (skill.unlockThreshold === null) return 'available'
      return 'locked'
    }
    return 'completed'
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
                        {status === 'completed' && (
                          <Badge variant="success">Completed</Badge>
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
                      {skill.score !== undefined && (
                        <div className="space-y-2">
                          <Progress value={skill.score} className="h-2" />
                          <p className="text-sm text-muted-foreground">Score: {skill.score.toFixed(0)}</p>
                        </div>
                      )}
                      {skill.unlockThreshold !== null && skill.score === undefined && (
                        <p className="text-sm text-muted-foreground">
                          Unlock at {skill.unlockThreshold} in previous skill
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