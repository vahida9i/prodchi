"use client"

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import type { AuthoredReveal, RevealBlock as RevealBlockData } from "@/lib/api-client"

interface RevealBlockProps {
  reveal: AuthoredReveal | RevealBlockData | null | undefined
  /** `compact` is the recap/history scale; `default` is the reveal card. */
  variant?: "default" | "compact"
}

/** Tolerates a bare sentence, so a payload recorded before tables still renders. */
function normalize(reveal: AuthoredReveal | RevealBlockData | null | undefined): RevealBlockData {
  if (typeof reveal === "string") return { text: reveal }
  return reveal ?? {}
}

/**
 * Renders what a choice revealed: prose, a data table, or both. The table is
 * authored content brought in through the challenge JSON — it is never
 * generated here. Cells stay plain strings so the author keeps control of the
 * formatting ("3.0%" vs "3%"), and the shadcn Table wrapper scrolls a wide
 * table instead of breaking the layout.
 */
export function RevealBlock({ reveal, variant = "default" }: RevealBlockProps) {
  const { text, table } = normalize(reveal)
  if (!text && !table) return null

  const textClassName = variant === "compact" ? "text-sm leading-relaxed" : "text-base leading-relaxed"

  return (
    <div className="space-y-4">
      {text && <p className={textClassName}>{text}</p>}
      {table && (
        <Table>
          {table.caption && <TableCaption>{table.caption}</TableCaption>}
          <TableHeader>
            <TableRow>
              {table.columns.map((column, index) => (
                <TableHead key={index}>{column}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.rows.map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <TableCell key={cellIndex} className={cellIndex === 0 ? "font-medium" : undefined}>
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}