import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { elapsedDay } from '../lib/progress'

export default function AddConvert() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError('Not signed in.')
      setSaving(false)
      return
    }

    const { data: mentor } = await supabase
      .from('mentors')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!mentor) {
      setError('Could not find your mentor profile. Try signing out and back in.')
      setSaving(false)
      return
    }

    const { data: convert, error: insertError } = await supabase
      .from('converts')
      .insert({
        mentor_id: mentor.id,
        name,
        email,
        start_date: startDate,
      })
      .select('id')
      .single()

    if (insertError || !convert) {
      setSaving(false)
      setError(insertError?.message ?? 'Something went wrong.')
      return
    }

    // Don't make them wait for the next daily cron run - send today's
    // lesson right now, the same way a manual resend does. Only do this if
    // the start date is today or earlier; a future start date means the
    // mentor deliberately wants their first lesson to wait, so let the
    // daily job pick them up naturally when that day arrives.
    const startsNoLaterThanToday = startDate <= new Date().toISOString().slice(0, 10)
    if (startsNoLaterThanToday) {
      const dayNumber = elapsedDay(startDate)
      const { error: sendError } = await supabase.functions.invoke('resend-video-email', {
        body: { convertId: convert.id, dayNumber },
      })
      if (sendError) {
        window.alert(
          `${name} was added, but the first email couldn't be sent automatically (${sendError.message}). You can resend it from their convert page.`,
        )
      }
    }

    setSaving(false)
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen px-4 py-8 max-w-md mx-auto">
      <h1 className="text-xl font-semibold text-brand-700 mb-6">Add a new convert</h1>
      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg border border-slate-200">
        <Field label="Name">
          <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Email (where daily videos are sent)">
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Start date">
          <input
            required
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputCls}
          />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          disabled={saving}
          className="w-full rounded-md bg-brand-500 py-2 text-white font-medium hover:bg-brand-600 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Start their first forty days'}
        </button>
      </form>
    </div>
  )
}

const inputCls = 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  )
}
