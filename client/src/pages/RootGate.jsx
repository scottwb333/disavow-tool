import { useAuth } from '@/context/AuthContext'
import { Home } from '@/pages/Home'
import { Landing } from '@/pages/Landing'

/**
 * Public marketing home for guests; signed-in users go straight to workspace flow.
 */
export function RootGate() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa] text-slate-500">
        Loading…
      </div>
    )
  }
  if (user) return <Home />
  return <Landing />
}
