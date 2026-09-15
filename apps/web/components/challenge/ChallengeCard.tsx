"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ChallengeCardProps {
  challenge: {
    id: string
    title: string
    description: string
    difficulty: number
    estimatedMinutes: number
    xpValue: number
    skillIds: string[]
  }
  onClick: () => void
}

export function ChallengeCard({ challenge, onClick }: ChallengeCardProps) {
  const difficultyColors = [
    'bg-green-100 text-green-800',
    'bg-blue-100 text-blue-800',
    'bg-yellow-100 text-yellow-800',
    'bg-orange-100 text-orange-800',
    'bg-red-100 text-red-800'
  ]

  return (
    <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={onClick}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{challenge.title}</CardTitle>
            <CardDescription>{challenge.description}</CardDescription>
          </div>
          <Badge variant="outline" className={cn(difficultyColors[challenge.difficulty - 1] || difficultyColors[0])}>
            Level {challenge.difficulty}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {challenge.estimatedMinutes} min
            </span>
            <span className="flex items-center gap-1 text-primary">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              +{challenge.xpValue} XP
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onClick() }}>
            Start
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}