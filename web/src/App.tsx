import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import { AppShell } from './shell/AppShell'
import Board from './pages/Board'
import Kanban from './pages/Kanban'
import Grid from './pages/Grid'
import Room from './pages/Room'
import Stories from './pages/Stories'
import Sprints from './pages/Sprints'
import Login from './pages/Login'
import Register from './pages/Register'
import { Placeholder } from './pages/Placeholder'

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
            <Route
              path="/story/:id"
              element={
                <Placeholder
                  title="Current story"
                  hint="Split view with live terminal + activity timeline. Unit 15 ships this."
                />
              }
            />
            <Route
              path="/backlog"
              element={
                <Placeholder
                  title="Backlog"
                  hint="Claim panel for unassigned todos. Unit 17 ships this."
                />
              }
            />
            <Route
              path="/stream"
              element={
                <Placeholder
                  title="Team stream"
                  hint="Terminal wall with agent-kind filters. Unit 18 ships this."
                />
              }
            />
            <Route
              path="/members"
              element={
                <Placeholder
                  title="Members"
                  hint="List + detail of each teammate. Unit 19 ships this."
                />
              }
            />
            <Route
              path="/compute"
              element={
                <Placeholder
                  title="Compute"
                  hint="Per-machine node cards. Unit 21 ships this."
                />
              }
            />
            <Route
              path="/overview"
              element={
                <Placeholder
                  title="Overview"
                  hint="Sprint KPIs + burnup + epics progress. Unit 20 ships this."
                />
              }
            />
            <Route
              path="/connect"
              element={
                <Placeholder
                  title="Connect"
                  hint="4-step onboarding wizard. Unit 22 ships this."
                />
              }
            />
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
