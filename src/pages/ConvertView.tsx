import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import StreakCalendar, { DayState } from '../components/StreakCalendar'

interface Row {
  convert_name: string
  start_date: string
  current_day: number
  day_number: number
  title: string
  duration: string
  url: string
  embed_url: string
  scheduled_date: string
  watched_at: string | null
}

/** "7:29" or "07:29" -> 449 seconds. */
function durationToSeconds(duration: string): number {
  const parts = duration.split(':').map(Number)
  if (parts.length !== 2 || parts.some(Number.isNaN)) return 0
  const [minutes, seconds] = parts
  return minutes * 60 + seconds
}

export default function ConvertView() {
  const { token } = useParams()
  const [searchParams] = useSearchParams()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [marking, setMarking] = useState(false)

  useEffect(() => {
    load()
  }, [token])

  // Every lesson email links to a specific day via ?day=N - without this,
  // the link is just the convert's generic page, which always shows
  // whatever day the elapsed-time math currently says is "today." That
  // meant an email correctly labeled "Day 1" could link to a page that,
  // if opened before a full day had actually passed (or if a mentor
  // deliberately resent a day ahead of schedule), still showed Day 0's
  // video - the email and the video it linked to could be out of sync.
  // With ?day=N, the featured video below always matches what the email
  // said, regardless of where the convert's real elapsed-day count is.
  // The calendar/streak below still reflects their *actual* progress.
  const requestedDayParam = searchParams.get('day')
  const requestedDay = requestedDayParam !== null ? Number(requestedDayParam) : null

  // We don't control the embedded player's playback events (it's a
  // third-party WVBS/YouTube embed we don't have API access to), so this is
  // an approximation, not true "did they actually press play" tracking: if
  // this page stays open for roughly the length of the video, we mark the
  // day watched automatically. The manual button below still exists for
  // anyone who'd rather mark it right away or if this doesn't fire.
  useEffect(() => {
    if (!rows || rows.length === 0) return
    const targetDay =
      requestedDay !== null && rows.some((r) => r.day_number === requestedDay)
        ? requestedDay
        : rows[0].current_day
    const featured = rows.find((r) => r.day_number === targetDay)
    if (!featured || featured.watched_at) return

    const seconds = durationToSeconds(featured.duration)
    if (seconds <= 0) return

    const timer = setTimeout(() => {
      markWatched(featured.day_number, { silent: true })
    }, seconds * 1000)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, requestedDay])

  async function load() {
    const { data, error } = await supabase.rpc('get_convert_view', { p_token: token })
    if (error) setError(error.message)
    else setRows(data as Row[])
    // Fire-and-forget - lets the mentor/admin dashboards show "last active"
    // for this convert. Not worth blocking or surfacing an error over.
    supabase.rpc('touch_convert_last_seen', { p_token: token })
  }

  async function markWatched(day: number, opts?: { silent?: boolean }) {
    if (!opts?.silent) setMarking(true)
    await supabase.rpc('mark_day_watched', { p_token: token, p_day: day })
    await load()
    if (!opts?.silent) setMarking(false)
  }

  if (error) {
    return (
      <Shell>
        <p className="text-red-600 text-sm">This link doesn't look right. Ask your mentor for a fresh one.</p>
      </Shell>
    )
  }
  if (!rows) return <Shell><p className="text-slate-400">Loading…</p></Shell>
  if (rows.length === 0) return <Shell><p className="text-slate-400">No lessons found.</p></Shell>

  const { convert_name, current_day } = rows[0]
  // Prefer the day the link asked for (?day=N, from an email) over the
  // elapsed-time "current day" - but only if it's a real day in this
  // convert's lineup, so a malformed/missing param just falls back to normal.
  const requested = requestedDay !== null ? rows.find((r) => r.day_number === requestedDay) : undefined
  const featured = requested ?? rows.find((r) => r.day_number === current_day)!
  const watchedByDay = new Map(rows.map((r) => [r.day_number, !!r.watched_at]))
  const doneCount = rows.filter((r) => r.watched_at).length

  const days: DayState[] = rows.map((r) => ({
    day: r.day_number,
    title: r.title,
    watched: !!r.watched_at,
    isToday: r.day_number === current_day,
    isFuture: r.day_number > current_day,
    isMissed: r.day_number < current_day && !watchedByDay.get(r.day_number),
  }))

  return (
    <Shell>
      <p className="text-sm text-slate-500">Hi {convert_name}, welcome back 👋</p>
      <h1 className="text-lg font-semibold text-brand-700 mt-1">
        Day {featured.day_number} of 40: {featured.title}
      </h1>
      <p className="text-xs text-slate-400 mb-4">{featured.duration}</p>

      <div className="relative w-full overflow-hidden rounded-md mb-2" style={{ paddingBottom: '56.25%' }}>
        <iframe
          key={featured.day_number}
          src={featured.embed_url}
          className="absolute inset-0 w-full h-full"
          frameBorder={0}
          allow="autoplay; encrypted-media; fullscreen"
          allowFullScreen
          title={featured.title}
        />
      </div>
      {!featured.watched_at && (
        <p className="text-center text-xs text-slate-400 mb-2">
          This marks itself done automatically once you've had it open for the video's length —
          or just tap below.
        </p>
      )}

      {featured.watched_at ? (
        <p className="text-center text-sm text-emerald-600">✓ Marked watched</p>
      ) : (
        <button
          disabled={marking}
          onClick={() => markWatched(featured.day_number)}
          className="w-full rounded-md border border-brand-500 text-brand-600 py-2.5 font-medium hover:bg-brand-50 disabled:opacity-50"
        >
          {marking ? 'Saving…' : "I've watched this"}
        </button>
      )}

      <p className="mt-6 mb-2 text-sm font-medium text-slate-600">Your journey ({doneCount}/41)</p>
      <StreakCalendar days={days} />
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-sm mx-auto">{children}</div>
    </div>
  )
}
