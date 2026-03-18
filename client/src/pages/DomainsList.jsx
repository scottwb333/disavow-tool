import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
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

export function DomainsList() {
  const { workspaceId } = useParams()
  const [domains, setDomains] = useState([])
  const [myRole, setMyRole] = useState(null)
  const [open, setOpen] = useState(false)
  const [domainName, setDomainName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [err, setErr] = useState('')
  const [domainToDelete, setDomainToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = () =>
    api.get(`/workspaces/${workspaceId}/managed-domains`).then((r) => setDomains(r.data.domains || []))

  useEffect(() => {
    load()
    api.get(`/workspaces/${workspaceId}/me`).then((r) => setMyRole(r.data.role))
  }, [workspaceId])

  const canDelete = myRole === 'owner' || myRole === 'admin'

  const confirmDeleteDomain = async () => {
    if (!domainToDelete) return
    setDeleting(true)
    try {
      await api.delete(`/workspaces/${workspaceId}/managed-domains/${domainToDelete._id}`)
      toast.success('Domain removed')
      setDomainToDelete(null)
      load()
    } catch (ex) {
      toast.error(ex.response?.data?.error || ex.message)
    } finally {
      setDeleting(false)
    }
  }

  const add = async (e) => {
    e.preventDefault()
    setErr('')
    try {
      await api.post(`/workspaces/${workspaceId}/managed-domains`, {
        domainName,
        displayName: displayName || domainName
      })
      setOpen(false)
      setDomainName('')
      setDisplayName('')
      load()
    } catch (ex) {
      setErr(ex.response?.data?.error || ex.message)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Managed domains</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Add domain</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New managed domain</DialogTitle>
            </DialogHeader>
            <form onSubmit={add} className="space-y-3 pt-2">
              <Input
                placeholder="example.com"
                value={domainName}
                onChange={(e) => setDomainName(e.target.value)}
              />
              <Input
                placeholder="Display name (optional)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              {err && <p className="text-sm text-destructive">{err}</p>}
              <Button type="submit">Create</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card className="border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Label</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.map((d) => (
                <TableRow key={d._id}>
                  <TableCell className="font-medium">{d.domainName}</TableCell>
                  <TableCell className="text-muted-foreground">{d.displayName}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/w/${workspaceId}/domains/${d._id}`}>Open</Link>
                    </Button>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDomainToDelete(d)}
                      >
                        Delete
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {domains.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No domains yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!domainToDelete} onOpenChange={(o) => !o && setDomainToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete managed domain?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{domainToDelete?.domainName}</span> and all
              backlink imports, classifications, and disavow history for this domain will be permanently
              removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={deleting} onClick={confirmDeleteDomain}>
              {deleting ? 'Deleting…' : 'Delete domain'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
