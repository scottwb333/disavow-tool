import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import api from '@/lib/api'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function AcceptInvite() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [preview, setPreview] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/invites/${encodeURIComponent(token)}`)
      .then((r) => {
        if (!r.ok) throw new Error('Invalid or expired invite')
        return r.json()
      })
      .then((data) => {
        if (!cancelled) setPreview(data)
      })
      .catch(() => {
        if (!cancelled) setErr('This invite link is invalid or has expired.')
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const accept = async () => {
    setBusy(true)
    try {
      const { data } = await api.post(`/invites/${encodeURIComponent(token)}/accept`)
      toast.success(data.alreadyMember ? 'You are already in this workspace' : 'Welcome to the workspace')
      navigate(`/w/${data.workspaceId}`)
    } catch (ex) {
      toast.error(ex.response?.data?.error || ex.message)
    } finally {
      setBusy(false)
    }
  }

  const loginUrl = `/login?next=${encodeURIComponent(`/invite/${token}`)}`

  if (err) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md border-border">
          <CardHeader>
            <CardTitle>Invite unavailable</CardTitle>
            <CardDescription>{err}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link to="/">Go home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!preview) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading invite…
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border shadow-sm">
        <CardHeader>
          <CardTitle>Workspace invite</CardTitle>
          <CardDescription>
            You have been invited to join <strong className="text-foreground">{preview.workspaceName}</strong>{' '}
            as {preview.role}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This invite is for <span className="font-medium text-foreground">{preview.emailHint}</span>. Sign in with
            that email to join.
          </p>
          {user ? (
            <Button className="w-full" onClick={accept} disabled={busy}>
              {busy ? 'Joining…' : 'Accept invite'}
            </Button>
          ) : (
            <Button className="w-full" asChild>
              <Link to={loginUrl}>Sign in to accept</Link>
            </Button>
          )}
          <Button variant="ghost" className="w-full" asChild>
            <Link to="/">Cancel</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
