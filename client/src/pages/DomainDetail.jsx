import { useEffect, useState, useCallback, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { Ban, CircleDot, RotateCcw } from 'lucide-react'

function isRowInDisavow(s) {
  if (s.effectiveDecision === 'whitelist') return false
  return s.effectiveDecision === 'blacklist' || !!s.userApprovedForDisavow
}

function SourceStatusCell({ effectiveDecision, userApprovedForDisavow, disavowKind }) {
  const d = effectiveDecision || null
  if (d === 'whitelist') {
    return (
      <Badge variant="secondary" className="font-normal">
        Whitelist
      </Badge>
    )
  }
  if (d === 'blacklist' || userApprovedForDisavow) {
    const sub =
      disavowKind === 'global'
        ? 'Workspace'
        : disavowKind === 'local'
          ? 'This site'
          : disavowKind === 'approved'
            ? 'Approved'
            : null
    return (
      <div className="flex flex-col gap-0.5">
        <Badge variant="destructive" className="w-fit gap-1 font-medium">
          <Ban className="h-3 w-3" aria-hidden />
          Disavow
        </Badge>
        {sub ? (
          <span className="text-[10px] leading-tight text-muted-foreground">{sub}</span>
        ) : null}
      </div>
    )
  }
  if (d === 'needs_review') {
    return (
      <Badge variant="outline" className="border-amber-500/50 text-amber-800 dark:text-amber-200">
        Needs review
      </Badge>
    )
  }
  if (d === 'ignore') {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Ignored
      </Badge>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <CircleDot className="h-3.5 w-3.5 opacity-50" aria-hidden />
      Not classified
    </span>
  )
}

const decisions = [
  { value: 'all', label: 'All' },
  { value: 'whitelist', label: 'Whitelisted' },
  { value: 'blacklist', label: 'Disavow' },
  { value: 'needs_review', label: 'Needs review' },
  { value: 'ignore', label: 'Ignored' },
  { value: 'unclassified', label: 'Unclassified' }
]

export function DomainDetail() {
  const { workspaceId, domainId } = useParams()
  const [detail, setDetail] = useState(null)
  const [uploads, setUploads] = useState([])
  const [sources, setSources] = useState([])
  const [search, setSearch] = useState('')
  const [decision, setDecision] = useState('all')
  const [sort, setSort] = useState('rows')
  const [selected, setSelected] = useState({})
  const [panel, setPanel] = useState(null)
  const [disavowPreview, setDisavowPreview] = useState('')
  const [disavowPreviewLoading, setDisavowPreviewLoading] = useState(false)
  const [file, setFile] = useState(null)
  const [rowsPage, setRowsPage] = useState({ rows: [], total: 0 })
  const [manualOpen, setManualOpen] = useState(false)
  const [manualDomain, setManualDomain] = useState('')
  const [manualDecision, setManualDecision] = useState('blacklist')
  const [manualNotes, setManualNotes] = useState('')
  const [sourcePage, setSourcePage] = useState(1)
  const [sourceTotal, setSourceTotal] = useState(0)
  const sourceLimit = 50
  const [disavowHistory, setDisavowHistory] = useState([])
  const [mainTab, setMainTab] = useState('sources')
  const [uploadBusy, setUploadBusy] = useState(false)
  const uploadPollRef = useRef(null)
  const [sourceRowBusy, setSourceRowBusy] = useState(null)

  const loadDetail = useCallback(() => {
    api.get(`/workspaces/${workspaceId}/managed-domains/${domainId}`).then((r) => setDetail(r.data))
  }, [workspaceId, domainId])

  const loadUploads = useCallback(() => {
    api
      .get(`/workspaces/${workspaceId}/managed-domains/${domainId}/uploads`)
      .then((r) => setUploads(r.data.uploads || []))
  }, [workspaceId, domainId])

  const loadSources = useCallback(() => {
    const params = new URLSearchParams()
    params.set('page', String(sourcePage))
    params.set('limit', String(sourceLimit))
    if (search) params.set('search', search)
    if (decision !== 'all') params.set('decision', decision)
    if (sort === 'ascore') params.set('sort', 'ascore')
    if (sort === 'rec') params.set('sort', 'recommendation')
    return api
      .get(`/workspaces/${workspaceId}/managed-domains/${domainId}/source-domains?${params}`)
      .then((r) => {
        setSources(r.data.sourceDomains || [])
        setSourceTotal(r.data.total ?? 0)
      })
  }, [workspaceId, domainId, search, decision, sort, sourcePage, sourceLimit])

  const loadDisavowHistory = useCallback(() => {
    api
      .get(`/workspaces/${workspaceId}/managed-domains/${domainId}/disavows`)
      .then((r) => setDisavowHistory(r.data.disavows || []))
  }, [workspaceId, domainId])

  const loadDisavowPreview = useCallback(async () => {
    setDisavowPreviewLoading(true)
    try {
      const { data } = await api.post(
        `/workspaces/${workspaceId}/managed-domains/${domainId}/disavow/preview`,
        {}
      )
      setDisavowPreview(data.content || '')
    } catch (ex) {
      toast.error(ex.response?.data?.error || ex.message || 'Preview failed')
      setDisavowPreview('')
    } finally {
      setDisavowPreviewLoading(false)
    }
  }, [workspaceId, domainId])

  useEffect(() => {
    setSourcePage(1)
  }, [search, decision, sort])

  useEffect(() => {
    loadDetail()
    loadUploads()
  }, [loadDetail, loadUploads])

  useEffect(() => {
    const t = setTimeout(loadSources, 200)
    return () => clearTimeout(t)
  }, [loadSources])

  useEffect(() => {
    if (mainTab === 'disavow') loadDisavowHistory()
  }, [mainTab, loadDisavowHistory])

  useEffect(() => {
    if (mainTab !== 'disavow') return
    loadDisavowPreview()
  }, [mainTab, loadDisavowPreview])

  useEffect(() => {
    api
      .get(`/workspaces/${workspaceId}/managed-domains/${domainId}/rows?limit=20`)
      .then((r) => setRowsPage({ rows: r.data.rows || [], total: r.data.total }))
  }, [workspaceId, domainId, uploads])

  const uploadCsv = async () => {
    if (!file || uploadBusy) return
    const fd = new FormData()
    fd.append('file', file)
    const useSync = file.size < 1.5 * 1024 * 1024
    setUploadBusy(true)
    try {
      if (useSync) {
        const { data } = await api.post(
          `/workspaces/${workspaceId}/managed-domains/${domainId}/uploads-sync`,
          fd,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        )
        {
          const dup = data.duplicateCount ?? 0
          const w = data.workspaceBlacklistApplied ?? 0
          const base = `Imported ${data.rowCount} rows (${dup} duplicates skipped)`
          toast.success(
            w > 0
              ? `${base}. ${w} source domain(s) matched your workspace disavow list — marked disavow for this site.`
              : base
          )
        }
        setFile(null)
        loadDetail()
        loadUploads()
        loadSources()
      } else {
        const { data } = await api.post(
          `/workspaces/${workspaceId}/managed-domains/${domainId}/uploads`,
          fd,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        )
        const uploadId = data.upload._id
        toast.message('Import running in background…')
        setFile(null)
        if (uploadPollRef.current) clearInterval(uploadPollRef.current)
        uploadPollRef.current = setInterval(async () => {
          try {
            const u = await api.get(
              `/workspaces/${workspaceId}/managed-domains/${domainId}/uploads/${uploadId}`
            )
            const st = u.data.upload?.status
            if (st === 'complete') {
              if (uploadPollRef.current) clearInterval(uploadPollRef.current)
              uploadPollRef.current = null
              {
                const up = u.data.upload
                const dup = up.duplicateCount || 0
                const w = up.workspaceBlacklistApplied ?? 0
                const base = `Imported ${up.rowCount} rows (${dup} duplicates skipped)`
                toast.success(
                  w > 0
                    ? `${base}. ${w} source domain(s) matched your workspace disavow list — marked disavow for this site.`
                    : base
                )
              }
              loadDetail()
              loadUploads()
              loadSources()
              setUploadBusy(false)
            } else if (st === 'failed') {
              if (uploadPollRef.current) clearInterval(uploadPollRef.current)
              uploadPollRef.current = null
              toast.error(u.data.upload?.errorMessage || 'Import failed')
              setUploadBusy(false)
            }
          } catch {
            if (uploadPollRef.current) clearInterval(uploadPollRef.current)
            uploadPollRef.current = null
            setUploadBusy(false)
          }
        }, 1200)
      }
    } catch (ex) {
      toast.error(ex.response?.data?.error || ex.message)
      setUploadBusy(false)
    } finally {
      if (useSync) setUploadBusy(false)
    }
  }

  const classify = async (root, dec, notes = '', silent) => {
    await api.post(`/workspaces/${workspaceId}/classifications`, {
      managedDomainId: domainId,
      entityType: 'source_domain',
      value: root,
      decision: dec,
      notes,
      manual: true
    })
    if (!silent) toast.success('Saved')
    loadSources()
    if (panel?.analysis?.sourceRootDomain === root) setPanel((p) => ({ ...p, effectiveDecision: dec }))
  }

  const bulkClassify = async (dec) => {
    const roots = Object.keys(selected).filter((k) => selected[k])
    if (!roots.length) return
    try {
      await api.post(
        `/workspaces/${workspaceId}/managed-domains/${domainId}/classifications/bulk`,
        { decision: dec, sourceRootDomains: roots }
      )
      setSelected({})
      toast.success(`Updated ${roots.length} domains`)
      loadSources()
    } catch (ex) {
      toast.error(ex.response?.data?.error || ex.message)
    }
  }

  const markGlobalDisavow = async (root) => {
    const key = `g:${root}`
    setSourceRowBusy(key)
    try {
      await api.post(`/workspaces/${workspaceId}/classifications`, {
        entityType: 'source_domain',
        value: root,
        decision: 'blacklist',
        notes: '',
        manual: true
      })
      toast.success('Added to workspace disavow list (all sites)')
      loadSources()
      if (panel?.analysis?.sourceRootDomain === root) {
        setPanel((p) => (p ? { ...p, effectiveDecision: 'blacklist' } : p))
      }
      if (mainTab === 'disavow') loadDisavowPreview()
    } catch (ex) {
      toast.error(ex.response?.data?.error || ex.message)
    } finally {
      setSourceRowBusy(null)
    }
  }

  const markLocalDisavow = async (root) => {
    const key = `l:${root}`
    setSourceRowBusy(key)
    try {
      await api.post(`/workspaces/${workspaceId}/classifications`, {
        managedDomainId: domainId,
        entityType: 'source_domain',
        value: root,
        decision: 'blacklist',
        notes: '',
        manual: true
      })
      toast.success('Disavow on this site only')
      loadSources()
      if (panel?.analysis?.sourceRootDomain === root) {
        setPanel((p) => (p ? { ...p, effectiveDecision: 'blacklist' } : p))
      }
      if (mainTab === 'disavow') loadDisavowPreview()
    } catch (ex) {
      toast.error(ex.response?.data?.error || ex.message)
    } finally {
      setSourceRowBusy(null)
    }
  }

  const revertRowDisavow = async (row) => {
    const root = row.sourceRootDomain
    const key = `r:${root}`
    setSourceRowBusy(key)
    try {
      const enc = encodeURIComponent(root)
      if (row.userApprovedForDisavow) {
        await api.post(
          `/workspaces/${workspaceId}/managed-domains/${domainId}/analysis/approve`,
          { sourceRootDomain: root, approved: false }
        )
      }
      if (row.effectiveDecision === 'blacklist') {
        await api.post(
          `/workspaces/${workspaceId}/managed-domains/${domainId}/source-domains/${enc}/revert-disavow`
        )
      }
      toast.success('Removed from disavow for this site')
      loadSources()
      if (mainTab === 'disavow') loadDisavowPreview()
      if (panel?.analysis?.sourceRootDomain === root) {
        const { data } = await api.get(
          `/workspaces/${workspaceId}/managed-domains/${domainId}/source-domains/${enc}/detail`
        )
        setPanel(data)
      }
    } catch (ex) {
      toast.error(ex.response?.data?.error || ex.message)
    } finally {
      setSourceRowBusy(null)
    }
  }

  const openPanel = async (root) => {
    const enc = encodeURIComponent(root)
    const { data } = await api.get(
      `/workspaces/${workspaceId}/managed-domains/${domainId}/source-domains/${enc}/detail`
    )
    setPanel(data)
  }

  const exportDisavow = async () => {
    const { data } = await api.post(
      `/workspaces/${workspaceId}/managed-domains/${domainId}/disavow/export`,
      {}
    )
    const raw = (detail?.domainName || detail?.displayName || 'disavow').trim()
    const slug = raw
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 120) || 'site'
    const filename = `${slug}_disavow.txt`
    const blob = new Blob([data.content], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success(`Downloaded ${filename}`)
    loadDisavowHistory()
    loadDisavowPreview()
  }

  const approveAnalysis = async (root, approved) => {
    await api.post(
      `/workspaces/${workspaceId}/managed-domains/${domainId}/analysis/approve`,
      { sourceRootDomain: root, approved }
    )
    loadSources()
    if (panel?.analysis?.sourceRootDomain === root) {
      setPanel((p) => ({ ...p, analysis: { ...p.analysis, userApprovedForDisavow: approved } }))
    }
    toast.success(approved ? 'Added to disavow file' : 'Removed from disavow file')
    if (mainTab === 'disavow') loadDisavowPreview()
  }

  const addManualDomain = async (e) => {
    e.preventDefault()
    await api.post(`/workspaces/${workspaceId}/classifications`, {
      managedDomainId: domainId,
      entityType: 'source_domain',
      value: manualDomain.trim().toLowerCase(),
      decision: manualDecision,
      notes: manualNotes,
      manual: true
    })
    setManualOpen(false)
    setManualDomain('')
    setManualNotes('')
    toast.success('Rule added')
    loadSources()
  }

  if (!detail) return <p className="text-muted-foreground">Loading…</p>

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{detail.displayName || detail.domainName}</h1>
          <p className="text-sm text-muted-foreground">{detail.domainName}</p>
        </div>
        <Button variant="outline" size="sm" className="border-border" asChild>
          <Link to={`/w/${workspaceId}/domains/${domainId}/review`}>Review queue</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Backlink rows</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{detail.stats?.rowCount ?? 0}</CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Source domains</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{detail.stats?.analysisCount ?? 0}</CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Uploads</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{detail.stats?.uploadCount ?? 0}</CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Disavowed domains</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {detail.stats?.disavowedDomainCount ?? 0}
          </CardContent>
        </Card>
      </div>

      <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="sources">Source domains</TabsTrigger>
          <TabsTrigger value="upload">CSV upload</TabsTrigger>
          <TabsTrigger value="rows">Backlink rows</TabsTrigger>
          <TabsTrigger value="disavow">Disavow</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">SEMrush CSV</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-4">
              <Input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0])} />
              <Button onClick={uploadCsv} disabled={!file || uploadBusy}>
                {uploadBusy ? 'Working…' : 'Upload & import'}
              </Button>
              <p className="w-full text-xs text-muted-foreground">
                Small files import immediately. Larger CSVs upload in the background with streaming import
                (low server memory).
              </p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">Recent uploads</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {uploads.map((u) => (
                  <li key={u._id} className="flex justify-between border-b border-border py-2">
                    <span>{u.filename}</span>
                    <span className="text-muted-foreground">
                      {u.rowCount} rows · {u.status}
                    </span>
                  </li>
                ))}
                {uploads.length === 0 && <li className="text-muted-foreground">No uploads yet</li>}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Search domain…"
              className="max-w-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select value={decision} onValueChange={setDecision}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                {decisions.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rows">Sort: row count</SelectItem>
                <SelectItem value="ascore">Sort: low ascore</SelectItem>
                <SelectItem value="rec">Sort: recommendation</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setManualOpen(true)}>
              Add domain rule
            </Button>
            {Object.keys(selected).some((k) => selected[k]) && (
              <div className="ml-auto flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => bulkClassify('blacklist')}>
                  Bulk blacklist
                </Button>
                <Button variant="secondary" size="sm" onClick={() => bulkClassify('whitelist')}>
                  Bulk whitelist
                </Button>
              </div>
            )}
          </div>
          <Card className="border-border">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Domain</TableHead>
                    <TableHead>Rows</TableHead>
                    <TableHead>Avg ascore</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead className="min-w-[140px]">Disavow / status</TableHead>
                    <TableHead className="min-w-[200px]">Actions</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sources.map((s) => (
                    <TableRow
                      key={s.sourceRootDomain}
                      className={cn(
                        isRowInDisavow(s) &&
                          'border-l-4 border-l-destructive bg-destructive/[0.06] hover:bg-destructive/[0.09]'
                      )}
                    >
                      <TableCell>
                        <Checkbox
                          checked={!!selected[s.sourceRootDomain]}
                          onCheckedChange={(c) =>
                            setSelected((prev) => ({ ...prev, [s.sourceRootDomain]: !!c }))
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          {s.sourceRootDomain}
                          {isRowInDisavow(s) ? (
                            <Ban className="h-3.5 w-3.5 shrink-0 text-destructive" aria-label="Disavow" />
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell>{s.rowCount}</TableCell>
                      <TableCell>{s.avgPageAscore ?? '—'}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            s.recommendation?.level === 'high'
                              ? 'destructive'
                              : s.recommendation?.level === 'medium'
                                ? 'outline'
                                : 'default'
                          }
                        >
                          {s.recommendation?.level || 'low'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <SourceStatusCell
                          effectiveDecision={s.effectiveDecision}
                          userApprovedForDisavow={!!s.userApprovedForDisavow}
                          disavowKind={s.disavowKind}
                        />
                      </TableCell>
                      <TableCell>
                        {isRowInDisavow(s) ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8"
                            disabled={sourceRowBusy === `r:${s.sourceRootDomain}`}
                            onClick={() => revertRowDisavow(s)}
                          >
                            <RotateCcw
                              className={`mr-1 h-3.5 w-3.5 ${sourceRowBusy === `r:${s.sourceRootDomain}` ? 'animate-spin' : ''}`}
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
                              title="Workspace list — disavows on every managed domain"
                              disabled={sourceRowBusy === `g:${s.sourceRootDomain}`}
                              onClick={() => markGlobalDisavow(s.sourceRootDomain)}
                            >
                              {sourceRowBusy === `g:${s.sourceRootDomain}` ? '…' : 'Global disavow'}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 border-destructive/40 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                              title="This property only"
                              disabled={sourceRowBusy === `l:${s.sourceRootDomain}`}
                              onClick={() => markLocalDisavow(s.sourceRootDomain)}
                            >
                              {sourceRowBusy === `l:${s.sourceRootDomain}` ? '…' : 'Local disavow'}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => openPanel(s.sourceRootDomain)}>
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {sourceTotal > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-4 py-2 text-sm text-muted-foreground">
              <Button
                variant="outline"
                size="sm"
                disabled={sourcePage <= 1}
                onClick={() => setSourcePage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span>
                {(sourcePage - 1) * sourceLimit + 1}–{Math.min(sourcePage * sourceLimit, sourceTotal)} of{' '}
                {sourceTotal}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={sourcePage * sourceLimit >= sourceTotal}
                onClick={() => setSourcePage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="rows">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">Recent rows ({rowsPage.total} total)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source URL</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Anchor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rowsPage.rows.map((r) => (
                    <TableRow key={r._id}>
                      <TableCell className="max-w-[200px] truncate text-xs">{r.sourceUrl}</TableCell>
                      <TableCell className="max-w-[160px] truncate text-xs">{r.targetUrl}</TableCell>
                      <TableCell className="max-w-[140px] truncate text-xs">{r.anchor}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="disavow" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Lists sources you marked <strong className="text-foreground">Global disavow</strong>,{' '}
            <strong className="text-foreground">Local disavow</strong>, or{' '}
            <strong className="text-foreground">Add to disavow file</strong> —{' '}
            <strong className="text-foreground">only if that domain or URL appears in this property&apos;s uploaded
            CSV</strong>. Workspace-wide rules alone do not add domains that are not linking to this site.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportDisavow}>Download disavow file</Button>
          </div>
          {disavowHistory.length > 0 && (
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Recent exports</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {disavowHistory.slice(0, 8).map((h) => (
                  <Button
                    key={h._id}
                    variant="outline"
                    size="sm"
                    className="border-border font-normal"
                    onClick={() => setDisavowPreview(h.content || '')}
                  >
                    {new Date(h.createdAt).toLocaleString()} · {h.lineCount ?? 0} lines
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}
          <Textarea
            className="min-h-[320px] font-mono text-xs"
            readOnly
            value={
              disavowPreviewLoading
                ? 'Loading preview…'
                : disavowPreview ||
                  '# No lines yet — disavow sources on the Sources tab (must appear in uploaded CSV)'
            }
          />
        </TabsContent>
      </Tabs>

      <Dialog open={!!panel} onOpenChange={() => setPanel(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{panel?.analysis?.sourceRootDomain}</DialogTitle>
          </DialogHeader>
          {panel && (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge>Rows: {panel.analysis?.rowCount}</Badge>
                <Badge variant="outline">Unique URLs: {panel.analysis?.uniqueSourceUrls}</Badge>
                <Badge variant="outline">Avg ascore: {panel.analysis?.avgPageAscore ?? '—'}</Badge>
              </div>
              <p className="text-muted-foreground">
                Recommendation: {panel.analysis?.recommendation?.level} (score{' '}
                {panel.analysis?.recommendation?.score})
              </p>
              {panel.analysis?.recommendation?.flags?.length > 0 && (
                <ul className="list-inside list-disc text-xs text-muted-foreground">
                  {panel.analysis.recommendation.flags.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              )}
              <p>Classification: {panel.effectiveDecision || 'none'}</p>
              <Separator />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => classify(panel.analysis.sourceRootDomain, 'whitelist')}>
                  Whitelist
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => markGlobalDisavow(panel.analysis.sourceRootDomain)}
                >
                  Global disavow
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => markLocalDisavow(panel.analysis.sourceRootDomain)}
                >
                  Local disavow
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => classify(panel.analysis.sourceRootDomain, 'needs_review')}
                >
                  Needs review
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => classify(panel.analysis.sourceRootDomain, 'ignore')}
                >
                  Ignore
                </Button>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Checkbox
                  checked={!!panel.analysis?.userApprovedForDisavow}
                  onCheckedChange={(c) =>
                    approveAnalysis(panel.analysis.sourceRootDomain, !!c)
                  }
                />
                <div className="space-y-0.5">
                  <span className="font-medium text-foreground">Add to disavow file</span>
                  <p className="text-xs text-muted-foreground">
                    Adds this domain to disavow.txt for this site when it appears in your CSV. Use when you agree
                    with the recommendation but have not used Global or Local disavow yet.
                  </p>
                </div>
              </div>
              <Separator />
              <p className="font-medium">Sample source URLs</p>
              <ul className="max-h-32 overflow-auto text-xs text-muted-foreground">
                {(panel.sourceUrls || []).slice(0, 30).map((u) => (
                  <li key={u} className="truncate">
                    {u}
                  </li>
                ))}
              </ul>
              <p className="font-medium">Anchors</p>
              <ul className="max-h-24 overflow-auto text-xs">
                {(panel.anchors || []).slice(0, 20).map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual domain rule</DialogTitle>
          </DialogHeader>
          <form onSubmit={addManualDomain} className="space-y-3">
            <Input
              placeholder="spamdomain.com"
              value={manualDomain}
              onChange={(e) => setManualDomain(e.target.value)}
            />
            <Select value={manualDecision} onValueChange={setManualDecision}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="blacklist">Blacklist</SelectItem>
                <SelectItem value="whitelist">Whitelist</SelectItem>
                <SelectItem value="needs_review">Needs review</SelectItem>
                <SelectItem value="ignore">Ignore</SelectItem>
              </SelectContent>
            </Select>
            <Textarea placeholder="Notes" value={manualNotes} onChange={(e) => setManualNotes(e.target.value)} />
            <Button type="submit">Save</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
