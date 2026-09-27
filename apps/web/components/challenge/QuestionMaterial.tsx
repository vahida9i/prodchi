import type { SanitizedQuestion } from '@/lib/api-client'

export function QuestionMaterial({ material }: { material: SanitizedQuestion['material'] }) {
  if (!material) return null
  return <div className="mb-5 space-y-4">
    {material.table && <div className="overflow-x-auto rounded-xl border"><table className="w-full text-right text-sm"><caption className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">{material.table.caption || 'داده‌های مسئله'}</caption><thead className="bg-muted/60"><tr>{material.table.columns.map((column, index) => <th key={index} className="whitespace-nowrap px-3 py-2 font-bold">{column}</th>)}</tr></thead><tbody>{material.table.rows.map((row, rowIndex) => <tr key={rowIndex} className="border-t">{row.map((cell, index) => <td key={index} className="px-3 py-2">{cell}</td>)}</tr>)}</tbody></table></div>}
    {material.image && <figure className="overflow-hidden rounded-xl border bg-muted/30"><img src={material.image.src} alt={material.image.alt} className="max-h-80 w-full object-contain" /><figcaption className="px-3 py-2 text-xs text-muted-foreground">{material.image.alt}</figcaption></figure>}
  </div>
}
