import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import api from '@/lib/api'

export function Home() {
  const { user, loading } = useAuth()
  const [ws, setWs] = useState(null)

  useEffect(() => {
    if (!user) return
    api
      .get('/workspaces')
      .then((r) => {
        const list = r.data.workspaces || []
        setWs(list[0] || false)
      })
      .catch(() => setWs(false))
  }, [user])

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  if (ws === null) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>
  if (ws === false || !ws._id) return <Navigate to="/workspaces/new" replace />
  return <Navigate to={`/w/${ws._id}`} replace />
}
