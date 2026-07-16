import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useSession } from '../lib/useSession'
import { useMentorProfile } from '../lib/useMentorProfile'
import { elapsedDay, currentStreak, completedCount, ProgressRow } from '../lib/progress'

interface ConvertRow {
  id: string
  name: string
  email: string
  start_date: string
  active: boolean
  mentor_id: string
}

interface ConvertWithProgress extends ConvertRow {
  progress: ProgressRow[]
}

interface MentorRow {
  id: string
  name: string | null
  email: string | null
}

export default function MentorDashboard() {
  const [converts, setConverts] = useState<ConvertWithProgress[] | null>(null)
  const [mentors, setMentors] = useState<MentorRow[]>([])
  const [showAddMentor, setShowAddMentor] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newIsAdmin, setNewIsAdmin] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addedMsg, setAddedMsg] = useState<string | null>(null)
  const navigate = useNavigate()
  const { session } = useSession()
  const { profile } = useMentorProfile(session)

  useEffect(() => {
    load()
  }, [])

  async function addMentor(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setAddError(null)
    setAddedMsg(null)
    const { data, error } = await supabase.functions.invoke('admin-add-mentor', {
      body: { name: newName, email: newEmail, isAdmin: newIsAdmin },
    })
    setAdding(false)
    if (error || data?.error) {
      setAddError(data?.error ?? error?.message ?? 'Something went wrong.')
      return
    }
    setAddedMsg(`${newName} was added as ${newIsAdmin ? 'an admin' : 'a mentor'}.`)
    setNewName('')
    setNewEmail('')
    setNewIsAdmin(false)
  }

  async function load() {
    // No explicit mentor_id filter here - RLS scopes a plain mentor to just
    // their own converts, but an admin's extra "admin reads all converts"
    // policy means this same query returns *everyone's* converts for them.
    // That's intentional (an admin should be able to see the whole
    // program from their own dashboard, not just their own converts), but
    // it means we need the mentor name alongside each one so it's clear
    // whose is whose.
    const [{ data: convertRows }, { data: mentorRows }] = await Promise.all([
      supabase
        .from('converts')
        .select('id, name, email, start_date, active, mentor_id')
        .order('created_at', { ascending: false }),
      supabase.from('mentors').select('id, name, email'),
    ])
    setMentors(mentorRows ?? [])

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

  const mentorName = (id: string) => mentors.find((m) => m.id === id)?.name ?? mentors.find((m) => m.id === id)?.email ?? '—'

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen px-4 py-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-brand-700">
            {profile?.is_admin ? 'All converts' : 'Your converts'}
          </h1>
          {profile?.is_admin && (
            <p className="text-xs text-slate-500">
              You're seeing everyone's, since you're an admin — mentor shown on each one below.
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          {profile?.is_admin && (
            <Link to="/admin" className="text-sm text-brand-600 hover:underline">
              Full admin tools
            </Link>
          )}
          <button onClick={signOut} className="text-sm text-slate-500 hover:underline">
            Sign out
          </button>
        </div>
      </div>

      <Link
        to="/add-convert"
        className="block w-full text-center rounded-md bg-brand-500 text-white py-2 font-medium hover:bg-brand-600 mb-4"
      >
        + Add a new convert
      </Link>

      {profile?.is_admin && (
        <div className="mb-6">
          <button
            onClick={() => setShowAddMentor((v) => !v)}
            className="block w-full text-center rounded-md border border-brand-500 text-brand-600 py-2 font-medium hover:bg-brand-50"
          >
            {showAddMentor ? '− Hide add mentor/admin' : '+ Add a mentor or admin'}
          </button>

          {showAddMentor && (
            <form
              onSubmit={addMentor}
              className="mt-3 bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-end gap-3"
            >
              <div>
                <label className="block text-xs font-medium text-slate-700">Name</label>
                <input
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="mt-1 text-sm rounded-md border border-slate-300 px-2 py-1.5"
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Email</label>
                <input
                  required
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="mt-1 text-sm rounded-md border border-slate-300 px-2 py-1.5"
                  placeholder="you@example.com"
                />
              </div>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 pb-1.5">
                <input
                  type="checkbox"
                  checked={newIsAdmin}
                  onChange={(e) => setNewIsAdmin(e.target.checked)}
                />
                Make them an admin
              </label>
              <button
                disabled={adding}
                className="text-sm px-3 py-1.5 rounded-md bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {adding ? 'Adding…' : 'Add'}
              </button>
              {addError && <p className="w-full text-xs text-red-600">{addError}</p>}
              {addedMsg && <p className="w-full text-xs text-emerald-600">{addedMsg}</p>}
              <p className="w-full text-xs text-slate-400">
                They can sign in right away from the front door with this email + the shared
                mentor/admin code — no invite email needed.
              </p>
            </form>
          )}
        </div>
      )}

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
                  {profile?.is_admin && (
                    <p className="text-xs text-slate-400">Mentor: {mentorName(c.mentor_id)}</p>
                  )}
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
