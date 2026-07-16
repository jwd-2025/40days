export interface ProgressRow {
  day_number: number
  watched_at: string | null
}

// Computed in UTC (not the browser's local timezone) so this always agrees
// with the daily email job (send-daily-videos, which is also UTC-based) and
// with the database's own get_convert_view. Using local time here used to
// let the dashboard's "Day X" and the emailed "Day X" drift apart by a day
// for anyone outside UTC, especially for a few hours around midnight.
export function elapsedDay(startDate: string): number {
  const start = new Date(startDate + 'T00:00:00Z')
  const todayUtc = new Date().toISOString().slice(0, 10)
  const today = new Date(todayUtc + 'T00:00:00Z')
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
