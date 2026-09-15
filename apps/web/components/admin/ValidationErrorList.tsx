"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface ValidationError {
  path: string
  message: string
}

interface ValidationErrorListProps {
  errors: ValidationError[]
  className?: string
}

export function ValidationErrorList({ errors, className }: ValidationErrorListProps) {
  if (!errors.length) return null

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <Badge variant="destructive">Validation Errors ({errors.length})</Badge>
      </div>
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 max-h-60 overflow-y-auto">
        <ul className="space-y-1 text-sm">
          {errors.map((error, index) => (
            <li key={index} className="flex gap-2 text-destructive">
              <code className="bg-background px-1 rounded">{error.path}</code>
              <span>{error.message}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}