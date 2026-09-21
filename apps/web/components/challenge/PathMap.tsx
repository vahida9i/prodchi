"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DIFFICULTY_STYLES } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { LevelOnPath } from "@/lib/api-client"

const TYPE_LABEL: Record<string, string> = {
  challenge: "Scenario",
  single_question: "Quick call"
}

function starString(count: number): string {
  return "★".repeat(count) + "☆".repeat(Math.max(0, 3 - count))
}

/**
 * The level path as a vertical timeline: a rail of numbered nodes connected by
 * journey segments. A solid primary segment means the ground is covered (the
 * level before it is passed); muted segments mark what is still ahead. The
 * first unlocked level is the current position. A locked node is visible but
 * not playable (the server enforces the gate — this only keeps the UI honest
 * about it). A finished level keeps its best run visible, offers a replay
 * (which can never add XP), and links to the recap of its latest run when the
 * API reports one. Each node carries the challenge's authored brief on the
 * business above its status line — absent on content imported without one.
 */
export function PathMap({
  levels,
  startingId,
  onStart,
  onViewSummary
}: {
  levels: LevelOnPath[]
  startingId: string | null
  onStart: (level: LevelOnPath) => void
  /** Opens the recap of the level's latest finished run. */
  onViewSummary?: (level: LevelOnPath) => void
}) {
  if (levels.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No levels on the path yet. Check back soon!</p>
        </CardContent>
      </Card>
    )
  }

  // The candidate's position: the first level that is open but not yet passed.
  const currentIndex = levels.findIndex(level => level.progress.status === "unlocked")

  return (
    <ol className="relative">
      {levels.map((level, index) => (
        <LevelNode
          key={level.id}
          level={level}
          isCurrent={index === currentIndex}
          isLast={index === levels.length - 1}
          startingId={startingId}
          onStart={onStart}
          onViewSummary={onViewSummary}
        />
      ))}
    </ol>
  )
}

function LevelNode({
  level,
  isCurrent,
  isLast,
  startingId,
  onStart,
  onViewSummary
}: {
  level: LevelOnPath
  isCurrent: boolean
  isLast: boolean
  startingId: string | null
  onStart: (level: LevelOnPath) => void
  onViewSummary?: (level: LevelOnPath) => void
}) {
  const locked = level.progress.status === "locked"
  const passed = level.progress.status === "passed"

  return (
    <li
      className={cn("relative pb-8 pl-16 last:pb-0", locked && "opacity-60")}
      aria-current={isCurrent ? "step" : undefined}
    >
      {/* Journey segment from this node down to the next one. Solid means the
          ground is covered (this level is passed); muted means ahead. */}
      {!isLast && (
        <span
          aria-hidden
          className={cn("absolute bottom-0 left-[23px] top-12 w-0.5", passed ? "bg-primary" : "bg-border")}
        />
      )}

      {/* The node on the rail */}
      <span
        className={cn(
          "absolute left-0 top-0 flex h-12 w-12 items-center justify-center rounded-full border-2 text-base font-bold",
          passed && "border-primary bg-primary text-primary-foreground",
          !passed && locked && "border-dashed border-muted-foreground/40 bg-muted text-muted-foreground",
          !passed &&
            !locked &&
            (isCurrent
              ? "border-primary bg-primary/10 text-primary ring-4 ring-primary/15"
              : "border-primary/40 bg-primary/5 text-primary/70")
        )}
        aria-label={locked ? "Locked level" : `Level ${level.number}`}
      >
        {passed ? "✓" : locked ? "🔒" : level.number}
      </span>

      <Card>
        <CardContent className="flex items-center gap-4 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-medium">{level.title}</p>
              <Badge
                variant="outline"
                className={cn("capitalize", DIFFICULTY_STYLES[level.difficulty] ?? DIFFICULTY_STYLES.easy)}
              >
                {level.difficulty}
              </Badge>
              <Badge variant="outline">{level.industry.name}</Badge>
              <Badge variant="secondary">{TYPE_LABEL[level.type] ?? level.type}</Badge>
            </div>
            {/* The authored brief: what the company is and who its customers are.
                Clamped so a long summary cannot make this node outgrow the rest. */}
            {level.summary && (
              <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{level.summary}</p>
            )}
            <p className={cn("text-sm text-muted-foreground", level.summary && "mt-1")}>
              {passed
                ? `Passed — best ${level.progress.bestStars}★ · ${level.progress.bestXp} XP`
                : locked
                  ? "Pass the previous level to unlock"
                  : level.progress.attempts > 0
                    ? "Unlocked — replay to improve your best"
                    : `+${level.xpPerBest} XP per best call`}
            </p>
          </div>

          <div className="shrink-0 text-right">
            {passed && <div className="mb-1 text-sm text-yellow-500">{starString(level.progress.bestStars)}</div>}
            <div className="flex flex-wrap items-center justify-end gap-2">
              {level.progress.lastSessionId && (
                <Button size="sm" variant="outline" onClick={() => onViewSummary?.(level)}>
                  Review your run
                </Button>
              )}
              <Button
                size="sm"
                disabled={locked || startingId === level.id}
                onClick={() => onStart(level)}
              >
                {startingId === level.id ? "Starting…" : passed ? "Replay" : locked ? "Locked" : "Play"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </li>
  )
}