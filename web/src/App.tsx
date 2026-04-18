import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import Kanban from './pages/Kanban'
import Grid from './pages/Grid'
import Room from './pages/Room'
import Login from './pages/Login'
import Register from './pages/Register'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <Protected>
                <Kanban />
              </Protected>
            }
          />
          <Route
            path="/live"
            element={
              <Protected>
                <Grid />
              </Protected>
            }
          />
          <Route
            path="/room/:id"
            element={
              <Protected>
                <Room />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-8 text-muted">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}
