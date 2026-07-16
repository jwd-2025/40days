import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { VIDEOS } from '../data/videos'
import { elapsedDay, currentStreak, completedCount } from '../lib/progress'
import StreakCalendar, { DayState } from '../components/StreakCalendar'

interface Convert {
  id: string
  name: string
  email: string
  phone: string | null
  start_date: string
  active: boolean
  access_token: string
}

export default function ConvertProgress() {
  const { id } = useParams()
  const [convert, setConvert] = useState<Convert | null>(null)
  const [progress, setProgress] = useState<{ day_number: number; watched_at: string | null }[]>([])
  const [resendDay, setResendDay] = useState(0)
  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    supabase
      .from('converts')
      .select('id, name, email, phone, start_date, active, access_token')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setConvert(data)
        if (data) setResendDay(Math.min(elapsedDay(data.start_date), 40))
      })
    supabase
      .from('progress')
      .select('day_number, watched_at')
      .eq('convert_id', id)
      .then(({ data }) => setProgress(data ?? []))
  }, [id])

  async function handleResend() {
    if (!convert) return
    setResending(true)
    setResendMsg(null)
    const { error } = await supabase.functions.invoke('resend-video-email', {
      body: { convertId: convert.id, dayNumber: resendDay },
    })
    setResending(false)
    setResendMsg(error ? `Couldn't resend: ${error.message}` : `Day ${resendDay} email resent.`)
  }

  if (!convert) return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading…</div>

  const today = elapsedDay(convert.start_date)
  const streak = currentStreak(progress, today)
  const done = completedCount(progress)
  const watchedByDay = new Map(progress.map((p) => [p.day_number, !!p.watched_at]))

  const days: DayState[] = VIDEOS.map((v) => ({
    day: v.day,
    title: v.title,
    watched: !!watchedByDay.get(v.day),
    isToday: v.day === today,
    isFuture: v.day > today,
    isMissed: v.day < today && !watchedByDay.get(v.day),
  }))

  return (
    <div className="min-h-screen px-4 py-8 max-w-2xl mx-auto">
      <Link to="/dashboard" className="text-sm text-brand-600 hover:underline">
        ← All converts
      </Link>
      <h1 className="text-xl font-semibold text-brand-700 mt-2">{convert.name}</h1>
      <p className="text-sm text-slate-500">{convert.email} {convert.phone ? `· ${convert.phone}` : ''}</p>
      <p className="text-sm text-slate-500">Started {convert.start_date}</p>

      <div className="grid grid-cols-3 gap-3 my-6">
        <Stat label="Day" value={`${Math.min(today, 40)}/40`} />
        <Stat label="Streak" value={streak > 0 ? `🔥 ${streak}` : '—'} />
        <Stat label="Completed" value={`${done}/41`} />
      </div>

      <StreakCalendar days={days} />

      <div className="mt-6 text-xs text-slate-500 flex gap-4">
        <Legend color="bg-emerald-500" label="Watched" />
        <Legend color="bg-red-100 border border-red-200" label="Missed" />
        <Legend color="bg-brand-100 border border-brand-500" label="Today" />
        <Legend color="bg-slate-50 border border-slate-100" label="Upcoming" />
      </div>

      <p className="mt-8 text-xs text-slate-400 break-all">
        Their personal link (also emailed to them daily): {window.location.origin}/watch/{convert.access_token}
      </p>

      <div className="mt-6 bg-white border border-slate-200 rounded-lg p-4">
        <p className="text-sm font-medium text-slate-700 mb-2">Resend a lesson email</p>
        <p className="text-xs text-slate-500 mb-3">
          Use this if they say they never got an email, or if a start date got fixed after the fact.
        </p>
        <div className="flex items-center gap-2">
          <select
            value={resendDay}
            onChange={(e) => setResendDay(Number(e.target.value))}
            className="text-sm border border-slate-300 rounded px-2 py-1"
          >
            {VIDEOS.map((v) => (
              <option key={v.day} value={v.day}>
                Day {v.day}: {v.title}
              </option>
            ))}
          </select>
          <button
            onClick={handleResend}
            disabled={resending}
            className="text-sm px-3 py-1.5 rounded-md bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {resending ? 'Sending…' : 'Resend'}
          </button>
        </div>
        {resendMsg && <p className="mt-2 text-xs text-slate-500">{resendMsg}</p>}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
      <p className="text-lg font-semibold text-brand-700">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-3 h-3 rounded-sm inline-block ${color}`} />
      {label}
    </div>
  )
}
