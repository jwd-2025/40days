import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useSession } from '../lib/useSession'
import { useMentorProfile } from '../lib/useMentorProfile'
import { elapsedDay, completedCount } from '../lib/progress'

interface MentorRow {
  id: string
  name: string | null
  email: string | null
  is_admin: boolean
}

interface ConvertRow {
  id: string
  name: string
  email: string
  start_date: string
  active: boolean
  mentor_id: string
}

export default function AdminDashboard() {
  const [mentors, setMentors] = useState<MentorRow[] | null>(null)
  const [converts, setConverts] = useState<ConvertRow[] | null>(null)
  const [progressByConvert, setProgressByConvert] = useState<Record<string, { day_number: number; watched_at: string | null }[]>>({})
  const [mentorError, setMentorError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const navigate = useNavigate()
  const { session } = useSession()
  const { profile } = useMentorProfile(session)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const [{ data: mentorRows }, { data: convertRows }, { data: progressRows }] = await Promise.all([
      supabase.from('mentors').select('id, name, email, is_admin').order('name'),
      supabase.from('converts').select('id, name, email, start_date, active, mentor_id').order('created_at', { ascending: false }),
      supabase.from('progress').select('convert_id, day_number, watched_at'),
    ])
    setMentors(mentorRows ?? [])
    setConverts(convertRows ?? [])
    const grouped: Record<string, { day_number: number; watched_at: string | null }[]> = {}
    for (const p of progressRows ?? []) {
      grouped[p.convert_id] ??= []
      grouped[p.convert_id].push({ day_number: p.day_number, watched_at: p.watched_at })
    }
    setProgressByConvert(grouped)
  }

  async function toggleAdmin(mentorId: string, current: boolean) {
    await supabase.from('mentors').update({ is_admin: !current }).eq('id', mentorId)
    load()
  }

  async function toggleActive(convertId: string, current: boolean) {
    await supabase.from('converts').update({ active: !current }).eq('id', convertId)
    load()
  }

  async function reassign(convertId: string, newMentorId: string) {
    await supabase.from('converts').update({ mentor_id: newMentorId }).eq('id', convertId)
    load()
  }

  async function deleteConvert(convertId: string, name: string) {
    if (!window.confirm(`Permanently delete ${name} and their entire watch history? This can't be undone.`)) return
    setBusyId(convertId)
    const { error } = await supabase.rpc('delete_convert', { p_convert_id: convertId })
    setBusyId(null)
    if (error) {
      window.alert(`Couldn't delete: ${error.message}`)
      return
    }
    load()
  }

  async function deleteMentor(mentorId: string, name: string) {
    if (!window.confirm(`Permanently delete ${name}'s mentor account? This revokes their login. This can't be undone.`)) return
    setMentorError(null)
    setBusyId(mentorId)
    const { data, error } = await supabase.functions.invoke('admin-delete-mentor', {
      body: { mentorId },
    })
    setBusyId(null)
    if (error || data?.error) {
      setMentorError(data?.error ?? error?.message ?? 'Something went wrong.')
      return
    }
    load()
  }

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/')
  }

  const mentorName = (id: string) => mentors?.find((m) => m.id === id)?.name ?? '—'

  return (
    <div className="min-h-screen px-4 py-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-brand-700">Admin</h1>
          <p className="text-xs text-slate-500">Every mentor and every convert, across the whole program.</p>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="text-sm text-brand-600 hover:underline">
            My dashboard
          </Link>
          <button onClick={signOut} className="text-sm text-slate-500 hover:underline">
            Sign out
          </button>
        </div>
      </div>

      <section className="mb-10">
        <h2 className="text-sm font-semibold text-slate-600 mb-3">Mentors</h2>
        {mentorError && <p className="text-xs text-red-600 mb-2">{mentorError}</p>}
        <div className="bg-white border border-slate-200 rounded-lg divide-y">
          {mentors?.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-800">{m.name || '(no name)'}</p>
                <p className="text-xs text-slate-500">{m.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleAdmin(m.id, m.is_admin)}
                  className={`text-xs px-3 py-1 rounded-full border ${
                    m.is_admin
                      ? 'bg-brand-500 text-white border-brand-500'
                      : 'text-slate-500 border-slate-300 hover:border-brand-500'
                  }`}
                >
                  {m.is_admin ? 'Admin' : 'Make admin'}
                </button>
                {m.id !== profile?.id && (
                  <button
                    onClick={() => deleteMentor(m.id, m.name || m.email || 'this mentor')}
                    disabled={busyId === m.id}
                    className="text-xs px-3 py-1 rounded-full border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {busyId === m.id ? 'Deleting…' : 'Delete'}
                  </button>
                )}
              </div>
            </div>
          ))}
          {mentors?.length === 0 && <p className="px-4 py-3 text-sm text-slate-400">No mentors yet.</p>}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-600 mb-3">Converts</h2>
        <div className="space-y-3">
          {converts?.map((c) => {
            const progress = progressByConvert[c.id] ?? []
            const day = elapsedDay(c.start_date)
            const done = completedCount(progress)
            return (
              <div key={c.id} className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <Link to={`/convert/${c.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                      {c.name}
                    </Link>
                    <p className="text-xs text-slate-500">{c.email}</p>
                    <p className="text-xs text-slate-400">
                      Mentor: {mentorName(c.mentor_id)} · Started {c.start_date} · Day {Math.min(day, 40)}/40 ·{' '}
                      {done}/41 watched
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {!c.active && <span className="text-xs text-slate-400">Inactive</span>}
                    <button
                      onClick={() => toggleActive(c.id, c.active)}
                      className="text-xs px-3 py-1 rounded-full border border-slate-300 text-slate-500 hover:border-brand-500"
                    >
                      {c.active ? 'Deactivate' : 'Reactivate'}
                    </button>
                    <button
                      onClick={() => deleteConvert(c.id, c.name)}
                      disabled={busyId === c.id}
                      className="text-xs px-3 py-1 rounded-full border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {busyId === c.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="text-xs text-slate-500 mr-2">Reassign to:</label>
                  <select
                    value={c.mentor_id}
                    onChange={(e) => reassign(c.id, e.target.value)}
                    className="text-xs border border-slate-300 rounded px-2 py-1"
                  >
                    {mentors?.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name || m.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )
          })}
          {converts?.length === 0 && <p className="text-sm text-slate-400">No converts yet.</p>}
        </div>
      </section>
    </div>
  )
}
