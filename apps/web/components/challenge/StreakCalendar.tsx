"use client"

import { cn } from "@/lib/utils"

interface StreakCalendarProps {
  currentStreak: number
  longestStreak: number
  lastActiveDay: string | null
  className?: string
}

export function StreakCalendar({ currentStreak, longestStreak, lastActiveDay, className }: StreakCalendarProps) {
  // Streaks are tracked on UTC day boundaries by the API (spec Section 8.1), so the
  // calendar compares UTC days too - otherwise a UTC-midnight timestamp paints the
  // wrong day for viewers in negative-offset timezones.
  const toUtcDay = (date: Date) => date.toISOString().slice(0, 10)

  const today = new Date()
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
    date.setUTCDate(date.getUTCDate() - (6 - i))
    return date
  })

  const lastActive = lastActiveDay ? new Date(lastActiveDay) : null
  const todayKey = toUtcDay(today)

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-3xl font-bold">{currentStreak}</p>
          <p className="text-sm text-muted-foreground">Day Streak</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Longest</p>
          <p className="text-2xl font-bold">{longestStreak}</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        {days.map((day) => {
          const dayKey = toUtcDay(day)
          const isToday = dayKey === todayKey
          const isActive = lastActive ? dayKey === toUtcDay(lastActive) : false
          const isPast = dayKey < todayKey && !isActive

          return (
            <div key={day.toISOString()} className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "relative flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isToday
                    ? "bg-primary/20 text-primary border-2 border-primary"
                    : isPast
                    ? "bg-muted text-muted-foreground"
                    : "bg-muted/50 text-muted-foreground/50"
                )}
              >
                {day.getDate()}
              </div>
              <span className="text-xs text-muted-foreground">
                {day.toLocaleDateString('en-US', { weekday: 'short' })}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}