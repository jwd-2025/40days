import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { useSession } from './lib/useSession'
import { useMentorProfile } from './lib/useMentorProfile'
import PhoneEntry from './pages/PhoneEntry'
import MentorLogin from './pages/MentorLogin'
import MentorDashboard from './pages/MentorDashboard'
import AddConvert from './pages/AddConvert'
import ConvertProgress from './pages/ConvertProgress'
import ConvertView from './pages/ConvertView'
import AdminDashboard from './pages/AdminDashboard'

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center text-slate-500">{children}</div>
}

function RequireMentor({ children }: { children: JSX.Element }) {
  const { session, loading } = useSession()
  if (loading) return <Centered>Loading…</Centered>
  if (!session) return <Navigate to="/" replace />
  return children
}

function RequireAdmin({ children }: { children: JSX.Element }) {
  const { session, loading: sessionLoading } = useSession()
  const { profile, loading: profileLoading } = useMentorProfile(session)
  if (sessionLoading || profileLoading) return <Centered>Loading…</Centered>
  if (!session) return <Navigate to="/" replace />
  if (!profile?.is_admin) return <Navigate to="/dashboard" replace />
  return children
}

/**
 * Runs once, app-wide, whenever a magic link finishes signing someone in -
 * regardless of whether they arrived via the phone front door or the email
 * fallback form. Makes sure a `mentors` row exists, then routes them to the
 * admin or mentor dashboard as appropriate.
 */
function useAuthBootstrap() {
  const navigate = useNavigate()
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const storedName = localStorage.getItem('pending_mentor_name') ?? ''
        const storedPhone = localStorage.getItem('pending_mentor_phone') ?? ''
        await supabase.from('mentors').upsert(
          {
            auth_user_id: session.user.id,
            email: session.user.email,
            name: storedName || undefined,
            phone: storedPhone || undefined,
          },
          { onConflict: 'auth_user_id', ignoreDuplicates: false },
        )
        localStorage.removeItem('pending_mentor_name')
        localStorage.removeItem('pending_mentor_phone')

        const { data: mentor } = await supabase
          .from('mentors')
          .select('is_admin')
          .eq('auth_user_id', session.user.id)
          .single()
        navigate(mentor?.is_admin ? '/admin' : '/dashboard')
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [navigate])
}

export default function App() {
  useAuthBootstrap()

  return (
    <Routes>
      <Route path="/" element={<PhoneEntry />} />
      <Route path="/email-login" element={<MentorLogin />} />
      <Route
        path="/dashboard"
        element={
          <RequireMentor>
            <MentorDashboard />
          </RequireMentor>
        }
      />
      <Route
        path="/add-convert"
        element={
          <RequireMentor>
            <AddConvert />
          </RequireMentor>
        }
      />
      <Route
        path="/convert/:id"
        element={
          <RequireMentor>
            <ConvertProgress />
          </RequireMentor>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminDashboard />
          </RequireAdmin>
        }
      />
      {/* Public link the convert receives by email - no login required. */}
      <Route path="/watch/:token" element={<ConvertView />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
