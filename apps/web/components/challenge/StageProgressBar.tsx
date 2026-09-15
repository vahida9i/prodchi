"use client"

import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

/** The seven fixed challenge stages, in canonical order (spec Section 5.2). */
export const STAGES = ['FRAME', 'INVESTIGATE', 'DEFINE', 'EXPLORE', 'DECIDE', 'DESIGN', 'VALIDATE'] as const

interface StageProgressBarProps {
  currentStage: string
  completedStages?: string[]
  className?: string
}

/**
 * Progress indicator for the attempt screens.
 *
 * Progress is derived from the stage's position among the seven fixed stages,
 * never from a step count: challenges branch via `nextStepIndex`, so the number
 * of steps differs per path (spec Section 9).
 */
export function StageProgressBar({ currentStage, completedStages = [], className }: StageProgressBarProps) {
  const stageIndex = STAGES.indexOf(currentStage as (typeof STAGES)[number])
  const currentIndex = stageIndex === -1 ? 0 : stageIndex
  const progress = ((currentIndex + 1) / STAGES.length) * 100

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          Stage {currentIndex + 1} of {STAGES.length}
        </span>
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{currentStage}</span>
      </div>

      <Progress value={progress} />

      <div className="flex flex-wrap gap-1.5">
        {STAGES.map((stage, index) => {
          const isCurrent = index === currentIndex
          const isDone = completedStages.includes(stage)

          return (
            <Badge
              key={stage}
              variant={isCurrent ? "default" : isDone ? "secondary" : "outline"}
              className={cn(
                "text-[10px] uppercase tracking-wide",
                !isCurrent && !isDone && index > currentIndex && "opacity-50"
              )}
            >
              {stage}
            </Badge>
          )
        })}
      </div>
    </div>
  )
}