import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useSession } from '../lib/useSession'
import { useMentorProfile } from '../lib/useMentorProfile'

type Status = 'idle' | 'sending' | 'not_found' | 'wrong_code' | 'error'

export default function PhoneEntry() {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
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
      body: { phone, code },
    })
    if (error) {
      setStatus('error')
      return
    }

    // Converts get dropped straight into the app - their token is just an
    // unguessable ID for their own watch page, not a real account.
    if (data?.found && data.role === 'convert' && data.token) {
      navigate(`/watch/${data.token}`)
      return
    }

    // Mentors/admins: the function already minted a real session server-side
    // (via the shared sign-in code) and handed back its tokens directly -
    // setSession finishes signing them in with no email step at all.
    if (data?.found && data.access_token && data.refresh_token) {
      const { error: sessionErr } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      })
      if (sessionErr) {
        setStatus('error')
        return
      }
      navigate(data.role === 'admin' ? '/admin' : '/dashboard')
      return
    }

    if (data?.reason === 'wrong_code') {
      setStatus('wrong_code')
    } else {
      setStatus('not_found')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h1 className="text-xl font-semibold text-brand-700 mb-1">First Forty Days</h1>
        <p className="text-sm text-slate-500 mb-6">Enter your phone number to continue</p>

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

          <div>
            <label className="block text-sm font-medium text-slate-700">Mentor/admin code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              placeholder="Leave blank if you are not an admin"
            />
            <p className="mt-1 text-xs text-slate-400">
              Mentors and admins: enter the code your admin gave you.
            </p>
          </div>

          {status === 'wrong_code' && (
            <p className="text-sm text-amber-700">
              That didn't match. Check the code with your admin and try again.
            </p>
          )}
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
