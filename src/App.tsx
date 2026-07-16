import { Routes, Route, Navigate } from 'react-router-dom'
import { useSession } from './lib/useSession'
import { useMentorProfile } from './lib/useMentorProfile'
import FrontDoor from './pages/FrontDoor'
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

// There used to be a self-serve "create your account" flow (a magic-link
// form any visitor could fill in), plus a separate app-wide listener here
// that reacted to that sign-in and decided where to route someone. Both
// are gone now - mentor/admin accounts are only ever created by an admin
// (see FrontDoor.tsx's "add a mentor or admin" and MentorDashboard.tsx),
// which means the `mentors` row and its auth account always exist *before*
// anyone signs in. So the only sign-in path left is the front door's
// shared code (FrontDoor.tsx calls setSession() directly and navigates
// itself immediately, already knowing the role from identify-role's
// response), and the "already have a session" case (FrontDoor's own
// useEffect redirects a returning, still-signed-in visitor away from the
// front door screen). Neither needs anything extra done here.

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<FrontDoor />} />
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
