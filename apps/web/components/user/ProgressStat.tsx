"use client"

import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { digits } from "@/lib/i18n"

export function ProgressStat({
  label,
  value,
  icon: Icon,
  tone = "green",
}: {
  label: string
  value: string | number
  icon: LucideIcon
  tone?: "green" | "gold" | "blue" | "rose"
}) {
  const tones = {
    green: "bg-primary/10 text-primary",
    gold: "bg-amber-100 text-amber-700",
    blue: "bg-sky-100 text-sky-700",
    rose: "bg-rose-100 text-rose-700",
  }

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-2xl border bg-card px-3 py-2.5 shadow-sm">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tones[tone])}>
        <Icon size={18} strokeWidth={2.5} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[11px] text-muted-foreground">{label}</span>
        <span className="block text-base font-bold leading-5">{typeof value === "number" ? digits(value) : value}</span>
      </span>
    </div>
  )
}
