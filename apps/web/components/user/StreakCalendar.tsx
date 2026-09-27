import { digits } from '@/lib/utils'

export function StreakCalendar({ activityDays }: { activityDays: string[] }) {
  const today = new Date()
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(today)
  const value = (type: string) => Number(parts.find(part => part.type === type)?.value)
  const midnight = Date.UTC(value('year'), value('month') - 1, value('day'))
  const active = new Set(activityDays)
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(midnight - (6 - index) * 86400000)
    return { key: date.toISOString().slice(0, 10), label: date.toLocaleDateString('fa-IR', { weekday: 'short', timeZone: 'UTC' }), day: date.getUTCDate(), today: index === 6 }
  })
  return <div className="grid grid-cols-7 gap-1" aria-label="روزهای فعال هفت روز گذشته">{days.map(day => <div key={day.key} className="text-center"><p className="mb-2 text-[11px] text-muted-foreground">{day.label}</p><span aria-label={`${day.key}: ${active.has(day.key) ? 'فعال' : 'بدون فعالیت'}`} className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${active.has(day.key) ? 'bg-primary text-primary-foreground' : day.today ? 'border-2 border-primary text-primary' : 'bg-muted text-muted-foreground'}`}>{active.has(day.key) ? '✓' : digits(day.day)}</span></div>)}</div>
}
