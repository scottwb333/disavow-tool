import { useEffect, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  DialogTitle
} from '@/components/ui/dialog'
import { Ban, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

function isRowInDisavow(s) {
  if (s.effectiveDecision === 'whitelist') return false
  return s.effectiveDecision === 'blacklist' || !!s.userApprovedForDisavow
}

export function ReviewQueue() {
  const { workspaceId, domainId } = useParams()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [panel, setPanel] = useState(null)
  const [rowBusy, setRowBusy] = useState(null)
  const limit = 40

  const load = useCallback(() => {
    api
      .get(
        `/workspaces/${workspaceId}/managed-domains/${domainId}/review-queue?page=${page}&limit=${limit}`
      )
      .then((r) => {
        setItems(r.data.items || [])
        setTotal(r.data.total || 0)
      })
  }, [workspaceId, domainId, page])

  useEffect(() => {
    load()
  }, [load])

  const classify = async (root, dec) => {
    await api.post(`/workspaces/${workspaceId}/classifications`, {
      managedDomainId: domainId,
      entityType: 'source_domain',
      value: root,
      decision: dec,
      manual: true
    })
    toast.success('Updated')
    load()
    setPanel(null)
  }

  const markGlobalDisavow = async (root) => {
    setRowBusy(`g:${root}`)
    try {
      await api.post(`/workspaces/${workspaceId}/classifications`, {
        entityType: 'source_domain',
        value: root,
        decision: 'blacklist',
        notes: '',
        manual: true
      })
      toast.success('Added to workspace disavow list')
      load()
    } catch (ex) {
      toast.error(ex.response?.data?.error || ex.message)
    } finally {
      setRowBusy(null)
    }
  }

  const markLocalDisavow = async (root) => {
    setRowBusy(`l:${root}`)
    try {
      await api.post(`/workspaces/${workspaceId}/classifications`, {
        managedDomainId: domainId,
        entityType: 'source_domain',
        value: root,
        decision: 'blacklist',
        manual: true
      })
      toast.success('Disavow on this site only')
      load()
    } catch (ex) {
      toast.error(ex.response?.data?.error || ex.message)
    } finally {
      setRowBusy(null)
    }
  }

  const revertDisavowRow = async (s) => {
    const root = s.sourceRootDomain
    setRowBusy(`r:${root}`)
    try {
      const enc = encodeURIComponent(root)
      if (s.userApprovedForDisavow) {
        await api.post(
          `/workspaces/${workspaceId}/managed-domains/${domainId}/analysis/approve`,
          { sourceRootDomain: root, approved: false }
        )
      }
      if (s.effectiveDecision === 'blacklist') {
        await api.post(
          `/workspaces/${workspaceId}/managed-domains/${domainId}/source-domains/${enc}/revert-disavow`
        )
      }
      toast.success('Removed from disavow for this site')
      load()
    } catch (ex) {
      toast.error(ex.response?.data?.error || ex.message)
    } finally {
      setRowBusy(null)
    }
  }

  const openPanel = async (root) => {
    const enc = encodeURIComponent(root)
    const { data } = await api.get(
      `/workspaces/${workspaceId}/managed-domains/${domainId}/source-domains/${enc}/detail`
    )
    setPanel(data)
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
            <Link to={`/w/${workspaceId}/domains/${domainId}`}>← Back to domain</Link>
          </Button>
          <h1 className="text-2xl font-semibold">Review queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Domains marked needs review or medium/high heuristic score without a classification.
          </p>
        </div>
        <Badge variant="outline">{total} items</Badge>
      </div>
      <Card className="border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Rows</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Disavow / status</TableHead>
                <TableHead className="w-[200px]">Actions</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((s) => (
                <TableRow
                  key={s.sourceRootDomain}
                  className={cn(
                    isRowInDisavow(s) && 'border-l-4 border-l-destructive bg-destructive/[0.06]'
                  )}
                >
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      {s.sourceRootDomain}
                      {isRowInDisavow(s) ? (
                        <Ban className="h-3.5 w-3.5 text-destructive" aria-label="Disavow" />
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell>{s.rowCount}</TableCell>
                  <TableCell>
                    <Badge variant={s.recommendation?.level === 'high' ? 'destructive' : 'outline'}>
                      {s.recommendation?.score ?? 0}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {isRowInDisavow(s) ? (
                      <Badge variant="destructive" className="gap-1">
                        <Ban className="h-3 w-3" aria-hidden />
                        Disavow
                      </Badge>
                    ) : s.effectiveDecision === 'needs_review' ? (
                      <span className="text-muted-foreground">Needs review</span>
                    ) : (
                      <span className="text-muted-foreground">Suggested</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {isRowInDisavow(s) ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8"
                        disabled={rowBusy === `r:${s.sourceRootDomain}`}
                        onClick={() => revertDisavowRow(s)}
                      >
                        <RotateCcw
                          className={`mr-1 h-3.5 w-3.5 ${rowBusy === `r:${s.sourceRootDomain}` ? 'animate-spin' : ''}`}
                          aria-hidden
                        />
                        Undo
                      </Button>
                    ) : (
                      <div className="flex max-w-[148px] flex-col gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          title="Workspace list"
                          disabled={rowBusy === `g:${s.sourceRootDomain}` || rowBusy === `r:${s.sourceRootDomain}`}
                          onClick={() => markGlobalDisavow(s.sourceRootDomain)}
                        >
                          {rowBusy === `g:${s.sourceRootDomain}` ? '…' : 'Global disavow'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 border-destructive/40 px-2 text-xs text-destructive hover:bg-destructive/10"
                          title="This site only"
                          disabled={rowBusy === `l:${s.sourceRootDomain}` || rowBusy === `r:${s.sourceRootDomain}`}
                          onClick={() => markLocalDisavow(s.sourceRootDomain)}
                        >
                          {rowBusy === `l:${s.sourceRootDomain}` ? '…' : 'Local disavow'}
                        </Button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openPanel(s.sourceRootDomain)}>
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Queue is empty — great work.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="flex items-center px-2 text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <Dialog open={!!panel} onOpenChange={() => setPanel(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{panel?.analysis?.sourceRootDomain}</DialogTitle>
          </DialogHeader>
          {panel && (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Flags: {(panel.analysis?.recommendation?.flags || []).join(', ') || '—'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => markGlobalDisavow(panel.analysis.sourceRootDomain)}>
                  Global disavow
                </Button>
                <Button size="sm" variant="destructive" onClick={() => markLocalDisavow(panel.analysis.sourceRootDomain)}>
                  Local disavow
                </Button>
                <Button size="sm" variant="secondary" onClick={() => classify(panel.analysis.sourceRootDomain, 'whitelist')}>
                  Whitelist
                </Button>
                <Button size="sm" variant="outline" onClick={() => classify(panel.analysis.sourceRootDomain, 'ignore')}>
                  Ignore
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
