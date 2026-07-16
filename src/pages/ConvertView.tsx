import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
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
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [marking, setMarking] = useState(false)

  useEffect(() => {
    load()
  }, [token])

  // We don't control the embedded player's playback events (it's a
  // third-party WVBS/YouTube embed we don't have API access to), so this is
  // an approximation, not true "did they actually press play" tracking: if
  // this page stays open for roughly the length of the video, we mark the
  // day watched automatically. The manual button below still exists for
  // anyone who'd rather mark it right away or if this doesn't fire.
  useEffect(() => {
    if (!rows || rows.length === 0) return
    const current = rows.find((r) => r.day_number === rows[0].current_day)
    if (!current || current.watched_at) return

    const seconds = durationToSeconds(current.duration)
    if (seconds <= 0) return

    const timer = setTimeout(() => {
      markWatched(current.day_number, { silent: true })
    }, seconds * 1000)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  async function load() {
    const { data, error } = await supabase.rpc('get_convert_view', { p_token: token })
    if (error) setError(error.message)
    else setRows(data as Row[])
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
  const today = rows.find((r) => r.day_number === current_day)!
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
        Day {current_day} of 40: {today.title}
      </h1>
      <p className="text-xs text-slate-400 mb-4">{today.duration}</p>

      <div className="relative w-full overflow-hidden rounded-md mb-2" style={{ paddingBottom: '56.25%' }}>
        <iframe
          key={today.day_number}
          src={today.embed_url}
          className="absolute inset-0 w-full h-full"
          frameBorder={0}
          allow="autoplay; encrypted-media; fullscreen"
          allowFullScreen
          title={today.title}
        />
      </div>
      <a
        href={today.url}
        target="_blank"
        rel="noreferrer"
        className="block text-center text-xs text-slate-400 hover:text-brand-600 underline mb-4"
      >
        Trouble watching? Open on WVBS instead
      </a>

      {!today.watched_at && (
        <p className="text-center text-xs text-slate-400 mb-2">
          This marks itself done automatically once you've had it open for the video's length —
          or just tap below.
        </p>
      )}

      {today.watched_at ? (
        <p className="text-center text-sm text-emerald-600">✓ Marked watched</p>
      ) : (
        <button
          disabled={marking}
          onClick={() => markWatched(current_day)}
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
