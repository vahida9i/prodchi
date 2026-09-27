"use client"

import { ZoomIn } from "lucide-react"
import type { SanitizedQuestion } from "@/lib/api-client"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

export function QuestionMaterial({ material }: { material: SanitizedQuestion["material"] }) {
  if (!material) return null

  return (
    <div className="mb-5 space-y-4">
      {material.table && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-right text-sm">
            <caption className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
              {material.table.caption || "داده‌های مسئله"}
            </caption>
            <thead className="bg-muted/60">
              <tr>{material.table.columns.map((column, index) => <th key={index} className="whitespace-nowrap px-3 py-2 font-bold">{column}</th>)}</tr>
            </thead>
            <tbody>
              {material.table.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-t">
                  {row.map((cell, index) => <td key={index} className="px-3 py-2">{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {material.image && (
        <Dialog>
          <figure className="overflow-hidden rounded-xl border bg-muted/30">
            <DialogTrigger asChild>
              <button type="button" className="group relative block w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={`بزرگ‌نمایی تصویر: ${material.image.alt}`}>
                <img src={material.image.src} alt={material.image.alt} className="max-h-80 w-full object-contain" />
                <span className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-background/95 px-3 py-1.5 text-xs font-bold shadow-sm transition-transform group-hover:scale-105" aria-hidden="true">
                  <ZoomIn size={15} /> بزرگ‌نمایی
                </span>
              </button>
            </DialogTrigger>
            <figcaption className="px-3 py-2 text-xs leading-5 text-muted-foreground">{material.image.alt}</figcaption>
          </figure>
          <DialogContent className="max-h-[95dvh] w-[calc(100vw-1.5rem)] max-w-4xl gap-3 overflow-hidden p-3 sm:p-5">
            <DialogTitle className="pl-9 text-right text-base leading-7">تصویر پیوست سؤال</DialogTitle>
            <div className="max-h-[78dvh] overflow-auto rounded-lg bg-muted/30">
              <img src={material.image.src} alt={material.image.alt} className="w-full min-w-[640px] max-w-none object-contain sm:min-w-0" />
            </div>
            <p className="text-xs leading-5 text-muted-foreground">برای دیدن جزئیات، تصویر را در قاب جابه‌جا کنید.</p>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
