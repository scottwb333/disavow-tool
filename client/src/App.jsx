import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { ThemeProvider, useTheme } from '@/context/ThemeContext'
import { AppLayout } from '@/layouts/AppLayout'
import { Login } from '@/pages/Login'
import { WorkspaceNew } from '@/pages/WorkspaceNew'
import { WorkspaceDashboard } from '@/pages/WorkspaceDashboard'
import { DomainsList } from '@/pages/DomainsList'
import { DomainDetail } from '@/pages/DomainDetail'
import { WorkspaceRules } from '@/pages/WorkspaceRules'
import { WorkspaceTeam } from '@/pages/WorkspaceTeam'
import { ReviewQueue } from '@/pages/ReviewQueue'
import { AcceptInvite } from '@/pages/AcceptInvite'
import { RootGate } from '@/pages/RootGate'

function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function ThemedToaster() {
  const { theme } = useTheme()
  return <Toaster theme={theme} position="top-center" richColors />
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <ThemedToaster />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/invite/:token" element={<AcceptInvite />} />
          <Route path="/" element={<RootGate />} />
          <Route
            path="/workspaces/new"
            element={
              <Protected>
                <WorkspaceNew />
              </Protected>
            }
          />
          <Route
            path="/w/:workspaceId"
            element={
              <Protected>
                <AppLayout />
              </Protected>
            }
          >
            <Route index element={<WorkspaceDashboard />} />
            <Route path="domains" element={<DomainsList />} />
            <Route path="domains/:domainId" element={<DomainDetail />} />
            <Route path="domains/:domainId/review" element={<ReviewQueue />} />
            <Route path="rules" element={<WorkspaceRules />} />
            <Route path="team" element={<WorkspaceTeam />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  )
}
