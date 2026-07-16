import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { elapsedDay, currentStreak, completedCount, ProgressRow } from '../lib/progress'

interface ConvertRow {
  id: string
  name: string
  email: string
  start_date: string
  active: boolean
}

interface ConvertWithProgress extends ConvertRow {
  progress: ProgressRow[]
}

export default function MentorDashboard() {
  const [converts, setConverts] = useState<ConvertWithProgress[] | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: convertRows } = await supabase
      .from('converts')
      .select('id, name, email, start_date, active')
      .order('created_at', { ascending: false })

    if (!convertRows) {
      setConverts([])
      return
    }

    const withProgress: ConvertWithProgress[] = []
    for (const c of convertRows) {
      const { data: progress } = await supabase
        .from('progress')
        .select('day_number, watched_at')
        .eq('convert_id', c.id)
      withProgress.push({ ...c, progress: progress ?? [] })
    }
    setConverts(withProgress)
  }

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen px-4 py-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-brand-700">Your converts</h1>
        <button onClick={signOut} className="text-sm text-slate-500 hover:underline">
          Sign out
        </button>
      </div>

      <Link
        to="/add-convert"
        className="block w-full text-center rounded-md bg-brand-500 text-white py-2 font-medium hover:bg-brand-600 mb-6"
      >
        + Add a new convert
      </Link>

      {converts === null && <p className="text-slate-500">Loading…</p>}
      {converts?.length === 0 && (
        <p className="text-slate-500 text-sm">
          No one yet. Add a new convert above to start their first forty days.
        </p>
      )}

      <div className="space-y-3">
        {converts?.map((c) => {
          const day = elapsedDay(c.start_date)
          const streak = currentStreak(c.progress, day)
          const done = completedCount(c.progress)
          const pct = Math.round((done / 41) * 100)
          return (
            <Link
              key={c.id}
              to={`/convert/${c.id}`}
              className="block bg-white rounded-lg border border-slate-200 p-4 hover:border-brand-500 transition"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-slate-800">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-brand-600">
                    Day {Math.min(day, 40)} / 40
                  </p>
                  {streak > 0 ? (
                    <p className="text-xs text-amber-600">🔥 {streak} day streak</p>
                  ) : (
                    <p className="text-xs text-slate-400">No active streak</p>
                  )}
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-400">{done} of 41 videos watched</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
