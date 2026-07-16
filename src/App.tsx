import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { useSession } from './lib/useSession'
import { useMentorProfile } from './lib/useMentorProfile'
import FrontDoor from './pages/FrontDoor'
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
 * Runs once, app-wide, whenever someone gets signed in. There are two ways
 * that happens:
 *   1. The front door's shared code (FrontDoor.tsx calls setSession()
 *      directly) - FrontDoor already knows the role from identify-role's
 *      response and navigates itself, immediately, with no extra queries.
 *   2. Clicking the magic link from "create your account" (MentorLogin) -
 *      this always lands back on "/", and nothing else on that page knows
 *      the role yet, so THIS is what has to look it up and navigate.
 *
 * Both cases fire the same SIGNED_IN event, so without a guard this would
 * also run its (slower - upsert, then a separate query) navigate for case
 * 1, racing FrontDoor's own immediate navigate and usually winning because
 * it finishes last, bouncing an admin from /admin back to /dashboard right
 * after they land there. The pathname check below is that guard: by the
 * time this async chain finishes, FrontDoor's own navigate has already
 * moved case 1 off of "/", so only case 2 (still sitting on "/") proceeds.
 */
function useAuthBootstrap() {
  const navigate = useNavigate()
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const storedName = localStorage.getItem('pending_mentor_name') ?? ''
        await supabase.from('mentors').upsert(
          {
            auth_user_id: session.user.id,
            email: session.user.email,
            name: storedName || undefined,
          },
          { onConflict: 'auth_user_id', ignoreDuplicates: false },
        )
        localStorage.removeItem('pending_mentor_name')

        // See the note above - only the "just clicked a magic link" case
        // still needs this component to decide where to go.
        if (window.location.pathname !== '/') return

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
      <Route path="/" element={<FrontDoor />} />
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
