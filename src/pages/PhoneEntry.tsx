import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useSession } from '../lib/useSession'
import { useMentorProfile } from '../lib/useMentorProfile'

type Status = 'idle' | 'sending' | 'sent' | 'not_found' | 'error'

export default function PhoneEntry() {
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const { session } = useSession()
  const { profile, loading } = useMentorProfile(session)
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && profile) navigate(profile.is_admin ? '/admin' : '/dashboard')
  }, [loading, profile, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    const { data, error } = await supabase.functions.invoke('identify-role', {
      body: { phone },
    })
    if (error) {
      setStatus('error')
      return
    }
    if (data?.found) {
      // Converts get dropped straight into the app - their token is just an
      // unguessable ID for their own watch page, not a real account, so
      // there's no inbox to wait on. Mentors/admins still need to prove they
      // own their inbox before we hand them an edit-capable session.
      if (data.role === 'convert' && data.token) {
        navigate(`/watch/${data.token}`)
        return
      }
      setStatus('sent')
    } else {
      setStatus('not_found')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h1 className="text-xl font-semibold text-brand-700 mb-1">First Forty Days</h1>
        <p className="text-sm text-slate-500 mb-6">Enter your phone number to continue</p>

        {status === 'sent' && (
          <p className="text-center text-slate-600 text-sm">
            Check your email for a one-click sign-in link.
          </p>
        )}

        {status !== 'sent' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Phone number</label>
              <input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                placeholder="(555) 555-0100"
              />
            </div>

            {status === 'not_found' && (
              <p className="text-sm text-amber-700">
                We don't recognize that number. New converts: ask your mentor to add you. New
                mentors:{' '}
                <Link to="/email-login" className="underline">
                  sign in with email instead
                </Link>{' '}
                to create your account first.
              </p>
            )}
            {status === 'error' && (
              <p className="text-sm text-red-600">Something went wrong — try again.</p>
            )}

            <button
              disabled={status === 'sending'}
              className="w-full rounded-md bg-brand-500 py-2 text-white font-medium hover:bg-brand-600 disabled:opacity-50"
            >
              {status === 'sending' ? 'Looking up…' : 'Continue'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">
          Mentor signing in for the first time?{' '}
          <Link to="/email-login" className="underline">
            Use email instead
          </Link>
        </p>
      </div>
    </div>
  )
}
