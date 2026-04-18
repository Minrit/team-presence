import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import { AppShell } from './shell/AppShell'
import AgentSetup from './pages/AgentSetup'
import Backlog from './pages/Backlog'
import Board from './pages/Board'
import Compute from './pages/Compute'
import Connect from './pages/Connect'
import CurrentStory from './pages/CurrentStory'
import Kanban from './pages/Kanban'
import Members from './pages/Members'
import Overview from './pages/Overview'
import Stream from './pages/Stream'
import Grid from './pages/Grid'
import Room from './pages/Room'
import Stories from './pages/Stories'
import Sprints from './pages/Sprints'
import Login from './pages/Login'
import Register from './pages/Register'
/* Placeholder import removed now that all 8 Hive screens ship real pages. */

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<Shell />}>
            <Route path="/" element={<Board />} />
            <Route path="/board" element={<Board />} />
            <Route path="/story/:id" element={<CurrentStory />} />
            <Route path="/backlog" element={<Backlog />} />
            <Route path="/stream" element={<Stream />} />
            <Route path="/members" element={<Members />} />
            <Route path="/compute" element={<Compute />} />
            <Route path="/overview" element={<Overview />} />
            <Route path="/connect" element={<Connect />} />
            <Route path="/agent-setup" element={<AgentSetup />} />
            <Route path="/kanban" element={<Kanban />} />
            <Route path="/stories" element={<Stories />} />
            <Route path="/sprints" element={<Sprints />} />
            <Route path="/live" element={<Grid />} />
            <Route path="/room/:id" element={<Room />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

function Shell() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div style={{ padding: 32, color: 'var(--fg-3)', font: '400 13px/1 var(--font)' }}>
        Loading…
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
