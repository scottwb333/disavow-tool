import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Users, Link2, Copy, Trash2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

function inviteUrl(token) {
  const base = window.location.origin
  return `${base}/invite/${token}`
}

export function WorkspaceTeam() {
  const { profile } = useAuth()
  const { workspaceId } = useParams()
  const [ws, setWs] = useState(null)
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [myRole, setMyRole] = useState(null)
  const [addEmail, setAddEmail] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [memberToRemove, setMemberToRemove] = useState(null)
  const [inviteToRevoke, setInviteToRevoke] = useState(null)
  const [createdInvite, setCreatedInvite] = useState(null)
  const [removing, setRemoving] = useState(false)

  const load = useCallback(async () => {
    const [a, c, d] = await Promise.all([
      api.get(`/workspaces/${workspaceId}`),
      api.get(`/workspaces/${workspaceId}/members`),
      api.get(`/workspaces/${workspaceId}/me`)
    ])
    setWs(a.data)
    setMembers(c.data.members || [])
    const role = d.data.role
    setMyRole(role)
    if (role === 'owner' || role === 'admin') {
      try {
        const e = await api.get(`/workspaces/${workspaceId}/invites`)
        setInvites(e.data.invites || [])
      } catch {
        setInvites([])
      }
    } else {
      setInvites([])
    }
  }, [workspaceId])

  useEffect(() => {
    load()
  }, [load])

  const canInvite = myRole === 'owner' || myRole === 'admin'

  const addMemberDirect = async (e) => {
    e.preventDefault()
    if (!addEmail.trim()) return
    try {
      await api.post(`/workspaces/${workspaceId}/members`, {
        email: addEmail.trim().toLowerCase(),
        role: 'member'
      })
      toast.success('Member added')
      setAddEmail('')
      load()
    } catch (ex) {
      toast.error(ex.response?.data?.error || ex.message)
    }
  }

  const sendInvite = async (e) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    try {
      const { data } = await api.post(`/workspaces/${workspaceId}/invites`, {
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole
      })
      setCreatedInvite(data)
      setInviteEmail('')
      load()
      toast.success('Invite created — share the link')
    } catch (ex) {
      toast.error(ex.response?.data?.error || ex.message)
    }
  }

  const copyLink = (token) => {
    navigator.clipboard.writeText(inviteUrl(token))
    toast.success('Link copied')
  }

  const confirmRemoveMember = async () => {
    if (!memberToRemove) return
    setRemoving(true)
    try {
      await api.delete(`/workspaces/${workspaceId}/members/${memberToRemove._id}`)
      toast.success('Member removed')
      setMemberToRemove(null)
      load()
    } catch (ex) {
      toast.error(ex.response?.data?.error || ex.message)
    } finally {
      setRemoving(false)
    }
  }

  const confirmRevokeInvite = async () => {
    if (!inviteToRevoke) return
    try {
      await api.delete(`/workspaces/${workspaceId}/invites/${inviteToRevoke._id}`)
      toast.success('Invite revoked')
      setInviteToRevoke(null)
      load()
    } catch (ex) {
      toast.error(ex.response?.data?.error || ex.message)
    }
  }

  if (!ws) return <p className="text-muted-foreground">Loading…</p>

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Users className="h-7 w-7" />
          Team
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {ws.name} — {members.length} member{members.length !== 1 ? 's' : ''}
        </p>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <ul className="space-y-2 text-sm">
            {members.map((m) => {
              const uid = m.userId?._id || m.userId
              const isSelf = profile?.id && uid && String(uid) === String(profile.id)
              return (
                <li
                  key={m._id}
                  className="flex items-center justify-between gap-2 border-b border-border py-2"
                >
                  <span>{m.userId?.email || '—'}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground capitalize">{m.role}</span>
                    {canInvite && !isSelf && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-destructive hover:text-destructive"
                        onClick={() => setMemberToRemove(m)}
                      >
                        Remove
                      </Button>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>

          {canInvite && (
            <>
              <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                <p className="text-sm font-medium">Invite by link</p>
                <p className="text-xs text-muted-foreground">
                  They can sign up or sign in with the invited email, then open the link. Expires in 14 days.
                </p>
                <form onSubmit={sendInvite} className="flex flex-wrap items-end gap-2">
                  <Input
                    type="email"
                    placeholder="email@company.com"
                    className="max-w-xs"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="submit" size="sm" variant="secondary">
                    <Link2 className="mr-1.5 h-3.5 w-3.5" />
                    Create invite
                  </Button>
                </form>
              </div>

              {invites.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Pending invites</p>
                  <ul className="space-y-2">
                    {invites.map((inv) => (
                      <li
                        key={inv._id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                      >
                        <span>{inv.email}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize">
                            {inv.role}
                          </Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8"
                            onClick={() => copyLink(inv.token)}
                          >
                            <Copy className="h-3.5 w-3.5 mr-1" />
                            Copy link
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 text-destructive"
                            onClick={() => setInviteToRevoke(inv)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-lg border border-dashed border-border p-4 space-y-2">
                <p className="text-sm font-medium">Add existing user</p>
                <p className="text-xs text-muted-foreground">
                  If they already use the app, add them directly (same email as their account).
                </p>
                <form onSubmit={addMemberDirect} className="flex flex-wrap gap-2">
                  <Input
                    type="email"
                    placeholder="existing@user.com"
                    className="max-w-xs"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                  />
                  <Button type="submit" size="sm" variant="outline" className="border-border">
                    Add member
                  </Button>
                </form>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!memberToRemove} onOpenChange={(o) => !o && setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              {memberToRemove?.userId?.email || 'This user'} will lose access to this workspace and all its data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={removing}
              onClick={confirmRemoveMember}
            >
              {removing ? 'Removing…' : 'Remove'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!inviteToRevoke} onOpenChange={(o) => !o && setInviteToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke invite?</AlertDialogTitle>
            <AlertDialogDescription>
              The link for {inviteToRevoke?.email} will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={confirmRevokeInvite}>
              Revoke
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!createdInvite} onOpenChange={(o) => !o && setCreatedInvite(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite link ready</DialogTitle>
            <DialogDescription>
              Send this link to <strong>{createdInvite?.email}</strong>. They must use that email when signing in.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input readOnly value={createdInvite ? inviteUrl(createdInvite.token) : ''} className="font-mono text-xs" />
            <Button
              type="button"
              variant="secondary"
              onClick={() => createdInvite && copyLink(createdInvite.token)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <Button className="w-full" onClick={() => setCreatedInvite(null)}>
            Done
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
