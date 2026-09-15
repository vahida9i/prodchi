"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface BadgeGridProps {
  badges: Array<{
    id: string
    name: string
    description: string
    iconRef: string
    unlockCondition: any
    earned: boolean
    earnedAt: string | null
  }>
  className?: string
}

export function BadgeGrid({ badges, className }: BadgeGridProps) {
  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4", className)}>
      {badges.map((badge) => (
        <Tooltip key={badge.id}>
          <TooltipTrigger asChild>
            <Card className={cn(
              "h-24 flex flex-col items-center justify-center p-4 transition-all",
              badge.earned ? "bg-card border-primary/20" : "bg-muted/50 opacity-60"
            )}>
              <CardContent className="flex flex-col items-center justify-center gap-2 w-full">
                <span className="text-3xl">{badge.iconRef}</span>
                <span className="text-sm font-medium text-center">{badge.name}</span>
                {!badge.earned && (
                  <Badge variant="outline" className="text-xs">
                    Locked
                  </Badge>
                )}
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="top" align="center">
            <div className="max-w-xs space-y-1">
              <p className="font-medium">{badge.name}</p>
              <p className="text-sm text-muted-foreground">{badge.description}</p>
              <p className="text-xs text-muted-foreground">
                Unlock: {JSON.stringify(badge.unlockCondition)}
              </p>
              {badge.earned && badge.earnedAt && (
                <p className="text-xs text-green-600">
                  Earned: {new Date(badge.earnedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}