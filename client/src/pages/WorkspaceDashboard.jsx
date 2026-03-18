import { useEffect, useState, useCallback } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Separator } from '@/components/ui/separator'
import { Globe, Upload, Shield, Settings } from 'lucide-react'

export function WorkspaceDashboard() {
  const { workspaceId } = useParams()
  const navigate = useNavigate()
  const [ws, setWs] = useState(null)
  const [domains, setDomains] = useState([])
  const [sharedRulesCount, setSharedRulesCount] = useState(0)
  const [myRole, setMyRole] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)

  const load = useCallback(async () => {
    const [a, b, rulesRes, me] = await Promise.all([
      api.get(`/workspaces/${workspaceId}`),
      api.get(`/workspaces/${workspaceId}/managed-domains`),
      api
        .get(`/workspaces/${workspaceId}/classifications?scope=workspace`)
        .catch(() => ({ data: { rules: [] } })),
      api.get(`/workspaces/${workspaceId}/me`).catch(() => ({ data: { role: null } }))
    ])
    setWs(a.data)
    setDomains(b.data.domains || [])
    setSharedRulesCount((rulesRes.data?.rules || []).length)
    setMyRole(me.data?.role ?? null)
  }, [workspaceId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (ws?.name) setEditName(ws.name)
  }, [ws?.name])

  const canEditWorkspace = myRole === 'owner' || myRole === 'admin'

  const saveWorkspace = async (e) => {
    e.preventDefault()
    const name = editName.trim()
    if (!name) {
      toast.error('Name is required')
      return
    }
    setSaving(true)
    try {
      const { data } = await api.patch(`/workspaces/${workspaceId}`, { name })
      setWs((prev) => (prev ? { ...prev, ...data } : data))
      toast.success('Workspace updated')
      setSettingsOpen(false)
      window.dispatchEvent(new CustomEvent('workspace-updated', { detail: { workspaceId } }))
    } catch (ex) {
      toast.error(ex.response?.data?.error || ex.message)
    } finally {
      setSaving(false)
    }
  }

  const openDeleteWorkspace = () => {
    setSettingsOpen(false)
    setDeleteConfirmName('')
    setDeleteDialogOpen(true)
  }

  const deleteWorkspace = async () => {
    setDeleteBusy(true)
    try {
      await api.delete(`/workspaces/${workspaceId}`, {
        data: { confirmName: deleteConfirmName.trim() }
      })
      toast.success('Workspace deleted')
      window.dispatchEvent(new CustomEvent('workspace-updated', { detail: { workspaceId, deleted: true } }))
      navigate('/', { replace: true })
    } catch (ex) {
      toast.error(ex.response?.data?.error || ex.message)
    } finally {
      setDeleteBusy(false)
    }
  }

  const nameMatches =
    ws &&
    deleteConfirmName.trim().toLowerCase() === String(ws.name || '').trim().toLowerCase()

  if (!ws) return <p className="text-muted-foreground">Loading…</p>

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{ws.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {domains.length} managed domain{domains.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canEditWorkspace && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0 border-border"
            aria-label="Workspace settings"
            onClick={() => {
              setEditName(ws.name)
              setSettingsOpen(true)
            }}
          >
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={saveWorkspace}>
            <DialogHeader>
              <DialogTitle>Workspace settings</DialogTitle>
              <DialogDescription>Update the name shown across this workspace.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-4">
              <label htmlFor="ws-name" className="text-sm font-medium leading-none">
                Workspace name
              </label>
              <Input
                id="ws-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="My workspace"
                autoComplete="organization"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSettingsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
          <Separator className="my-4" />
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-destructive">Delete workspace</h3>
            <p className="text-sm text-muted-foreground">
              Permanently remove this workspace, all managed domains, uploads, rules, and team access.
              Only owners and admins can delete. Members cannot.
            </p>
            <Button type="button" variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10" onClick={openDeleteWorkspace}>
              Delete workspace…
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this workspace?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-left text-muted-foreground">
                <p>
                  This cannot be undone. All backlinks, classifications, disavow history, and invites for{' '}
                  <span className="font-medium text-foreground">{ws.name}</span> will be removed.
                </p>
                <div className="space-y-1.5">
                  <label htmlFor="delete-ws-confirm" className="text-sm font-medium text-foreground">
                    Type the workspace name to confirm
                  </label>
                  <Input
                    id="delete-ws-confirm"
                    value={deleteConfirmName}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                    placeholder={ws.name}
                    autoComplete="off"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={!nameMatches || deleteBusy}
              onClick={deleteWorkspace}
            >
              {deleteBusy ? 'Deleting…' : 'Delete workspace permanently'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Domains</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary">
              <Link to={`/w/${workspaceId}/domains`}>
                <Globe className="mr-2 h-4 w-4" />
                Manage domains
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Shared rules</CardTitle>
            <CardDescription>
              {sharedRulesCount} shared rule{sharedRulesCount !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="border-border">
              <Link to={`/w/${workspaceId}/rules`}>
                <Shield className="mr-2 h-4 w-4" />
                View rules
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {domains.length > 0 && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Recent domains</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {domains.slice(0, 5).map((d) => (
              <Link
                key={d._id}
                to={`/w/${workspaceId}/domains/${d._id}`}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm hover:bg-muted/30"
              >
                <span>{d.displayName || d.domainName}</span>
                <Upload className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
