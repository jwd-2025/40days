import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useSession } from '../lib/useSession'
import { useMentorProfile } from '../lib/useMentorProfile'

/**
 * One-time account creation for brand-new mentors (whoever isn't in the
 * `mentors` table yet). Actual post-login routing/mentor-row creation
 * happens once, centrally, in App.tsx's useAuthBootstrap - this page only
 * has to send the email. After this, they use the front door (email +
 * shared code) like everyone else.
 */
export default function MentorLogin() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { session } = useSession()
  const { profile, loading } = useMentorProfile(session)

  useEffect(() => {
    if (!loading && profile) navigate(profile.is_admin ? '/admin' : '/dashboard')
  }, [loading, profile, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    localStorage.setItem('pending_mentor_name', name)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/' },
    })
    if (error) setError(error.message)
    else setSent(true)
  }

  if (sent) {
    return (
      <Shell>
        <p className="text-center text-slate-600">
          Check <strong>{email}</strong> for a sign-in link. Open it on this device to continue.
        </p>
      </Shell>
    )
  }

  return (
    <Shell>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Your name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            placeholder="Jane Doe"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Your email</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            placeholder="you@example.com"
          />
          <p className="mt-1 text-xs text-slate-500">
            We'll email you a one-click sign-in link — no password to remember.
          </p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="w-full rounded-md bg-brand-500 py-2 text-white font-medium hover:bg-brand-600">
          Send sign-in link
        </button>
      </form>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h1 className="text-xl font-semibold text-brand-700 mb-1">First Forty Days</h1>
        <p className="text-sm text-slate-500 mb-6">Mentor sign-in with email</p>
        {children}
      </div>
    </div>
  )
}
