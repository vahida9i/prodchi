/** Persian users' calendar day, stable regardless of server timezone. */
export function tehranDayKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date)
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

export function tehranDayStart(date: Date): Date {
  return new Date(`${tehranDayKey(date)}T00:00:00.000Z`)
}
