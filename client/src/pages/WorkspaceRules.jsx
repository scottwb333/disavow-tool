import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
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

export function WorkspaceRules() {
  const { workspaceId } = useParams()
  const [rules, setRules] = useState([])
  const [open, setOpen] = useState(false)
  const [entityType, setEntityType] = useState('source_domain')
  const [value, setValue] = useState('')
  const [decision, setDecision] = useState('blacklist')
  const [notes, setNotes] = useState('')

  const load = () =>
    api
      .get(`/workspaces/${workspaceId}/classifications?scope=workspace`)
      .then((r) => setRules(r.data.rules || []))

  useEffect(() => {
    load()
  }, [workspaceId])

  const save = async (e) => {
    e.preventDefault()
    await api.post(`/workspaces/${workspaceId}/classifications`, {
      entityType,
      value,
      decision,
      notes,
      manual: true
    })
    toast.success('Workspace rule saved — applies to all managed domains (overridable per domain)')
    setOpen(false)
    setValue('')
    setNotes('')
    load()
  }

  const remove = async (id) => {
    await api.delete(`/workspaces/${workspaceId}/classifications/${id}`)
    toast.success('Removed')
    load()
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Shared workspace rules</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Blacklist or whitelist source domains/URLs for every managed domain in this workspace. Per-domain
            rules can override.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Add rule</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Workspace-wide classification</DialogTitle>
            </DialogHeader>
            <form onSubmit={save} className="space-y-3">
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="source_domain">Source domain</SelectItem>
                  <SelectItem value="source_url">Source URL</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder={entityType === 'source_domain' ? 'example.com' : 'https://…'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <Select value={decision} onValueChange={setDecision}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blacklist">Blacklist (disavow)</SelectItem>
                  <SelectItem value="whitelist">Whitelist</SelectItem>
                  <SelectItem value="needs_review">Needs review</SelectItem>
                  <SelectItem value="ignore">Ignore</SelectItem>
                </SelectContent>
              </Select>
              <Textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <Button type="submit">Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card className="border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Decision</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r._id}>
                  <TableCell>{r.entityType}</TableCell>
                  <TableCell className="max-w-[240px] truncate font-mono text-xs">{r.value}</TableCell>
                  <TableCell>
                    <span className="capitalize">{r.decision?.replace('_', ' ')}</span>
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate text-muted-foreground">{r.notes}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => remove(r._id)}>
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rules.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No workspace rules yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
