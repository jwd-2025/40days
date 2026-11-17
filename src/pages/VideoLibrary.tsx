import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useSession } from '../lib/useSession'
import { useMentorProfile } from '../lib/useMentorProfile'

interface VideoRow {
  day_number: number
  title: string
  duration: string | null
  url: string
  embed_url: string | null
}

export default function VideoLibrary() {
  const [videos, setVideos] = useState<VideoRow[] | null>(null)
  const [selectedDay, setSelectedDay] = useState(0)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ title: '', duration: '', url: '', embed_url: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const { session } = useSession()
  const { profile } = useMentorProfile(session)
  const isAdmin = !!profile?.is_admin

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('videos')
      .select('day_number, title, duration, url, embed_url')
      .order('day_number')
    setVideos((data as VideoRow[]) ?? [])
  }

  const selected = videos?.find((v) => v.day_number === selectedDay)

  function select(day: number) {
    setSelectedDay(day)
    setEditing(false)
    setMsg(null)
  }

  function startEdit() {
    if (!selected) return
    setForm({
      title: selected.title,
      duration: selected.duration ?? '',
      url: selected.url,
      embed_url: selected.embed_url ?? '',
    })
    setMsg(null)
    setEditing(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setSaving(true)
    setMsg(null)
    const { data, error } = await supabase
      .from('videos')
      .update({
        title: form.title.trim(),
        duration: form.duration.trim() || null,
        url: form.url.trim(),
        embed_url: form.embed_url.trim() || null,
      })
      .eq('day_number', selected.day_number)
      .select('day_number')
    setSaving(false)
    // RLS silently matches zero rows for non-admins instead of erroring, so
    // check that a row actually came back.
    if (error || !data || data.length === 0) {
      setMsg({ ok: false, text: error?.message ?? "Couldn't save — only admins can edit videos." })
      return
    }
    setMsg({ ok: true, text: 'Saved. Emails and convert watch pages now use this.' })
    setEditing(false)
    load()
  }

  return (
    <div className="min-h-screen px-4 py-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-brand-700">Video library</h1>
          <p className="text-xs text-slate-500">
            Watch any day's video here{isAdmin ? ', or fix its title, length, or links' : ''}.
          </p>
        </div>
        <Link to="/dashboard" className="text-sm text-brand-600 hover:underline">
          ← Dashboard
        </Link>
      </div>

      {videos === null && <p className="text-slate-500">Loading…</p>}

      {videos && (
        <select
          value={selectedDay}
          onChange={(e) => select(Number(e.target.value))}
          className="w-full min-w-0 mb-5 text-sm border border-slate-300 rounded-md px-3 py-2 bg-white"
        >
          {videos.map((v) => (
            <option key={v.day_number} value={v.day_number}>
              Day {v.day_number}: {v.title}
            </option>
          ))}
        </select>
      )}

      {selected && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-brand-700">
            Day {selected.day_number}: {selected.title}
          </h2>
          <p className="text-xs text-slate-400 mb-3">{selected.duration}</p>

          {selected.embed_url ? (
            <div className="relative w-full overflow-hidden rounded-md mb-3" style={{ paddingBottom: '56.25%' }}>
              <iframe
                key={selected.day_number + selected.embed_url}
                src={selected.embed_url}
                className="absolute inset-0 w-full h-full"
                frameBorder={0}
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
                title={selected.title}
              />
            </div>
          ) : (
            <p className="text-sm text-amber-700 mb-3">
              No embed link set for this day{isAdmin ? ' — add one below.' : '.'}
            </p>
          )}

          <div className="flex items-center gap-4 text-sm">
            <a href={selected.url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
              Open on WVBS ↗
            </a>
            {isAdmin && !editing && (
              <button onClick={startEdit} className="text-brand-600 hover:underline">
                Edit this video
              </button>
            )}
          </div>

          {msg && <p className={`mt-2 text-xs ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</p>}

          {isAdmin && editing && (
            <form onSubmit={save} className="mt-4 bg-white border border-slate-200 rounded-lg p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">Title</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="mt-1 w-full text-sm rounded-md border border-slate-300 px-2 py-1.5"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Length (mm:ss)</label>
                <input
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                  className="mt-1 w-32 text-sm rounded-md border border-slate-300 px-2 py-1.5"
                  placeholder="07:28"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Also sets how long a convert's page stays open before it auto-marks the day watched.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Page link (opens on WVBS)</label>
                <input
                  required
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  className="mt-1 w-full text-sm rounded-md border border-slate-300 px-2 py-1.5"
                  placeholder="https://video.wvbs.org/video/…/"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Embed link (the player)</label>
                <input
                  value={form.embed_url}
                  onChange={(e) => setForm({ ...form, embed_url: e.target.value })}
                  className="mt-1 w-full text-sm rounded-md border border-slate-300 px-2 py-1.5"
                  placeholder="https://video.wvbs.org/embed/?ID=…"
                />
              </div>
              <div className="flex gap-2">
                <button
                  disabled={saving}
                  className="text-sm px-3 py-1.5 rounded-md bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="text-sm px-3 py-1.5 rounded-md border border-slate-300 text-slate-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

    </div>
  )
}
