export interface ProgressRow {
  day_number: number
  watched_at: string | null
}

export function elapsedDay(startDate: string): number {
  const start = new Date(startDate + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  start.setHours(0, 0, 0, 0)
  const diff = Math.floor((today.getTime() - start.getTime()) / 86_400_000)
  return Math.min(Math.max(diff, 0), 40)
}

/** Current consecutive-day streak, counting back from the most recent day that should already be watched. */
export function currentStreak(rows: ProgressRow[], upToDay: number): number {
  const watchedByDay = new Map(rows.map((r) => [r.day_number, !!r.watched_at]))
  let streak = 0
  for (let day = upToDay; day >= 0; day--) {
    if (watchedByDay.get(day)) streak++
    else break
  }
  return streak
}

export function completedCount(rows: ProgressRow[]): number {
  return rows.filter((r) => r.watched_at).length
}
