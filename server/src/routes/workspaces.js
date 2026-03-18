import { Router } from 'express'
import mongoose from 'mongoose'
import os from 'os'
import fs from 'fs/promises'
import { randomUUID, randomBytes } from 'crypto'
import { Workspace } from '../models/Workspace.js'
import { WorkspaceMember } from '../models/WorkspaceMember.js'
import { ManagedDomain } from '../models/ManagedDomain.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { requireWorkspaceMember } from '../middleware/requireWorkspace.js'
import multer from 'multer'
import { BacklinkUpload } from '../models/BacklinkUpload.js'
import { processCsvBuffer } from '../services/csvImportService.js'
import { processCsvFileStream } from '../services/csvImportStream.js'
import { BacklinkRow } from '../models/BacklinkRow.js'
import { SourceDomainAnalysis } from '../models/SourceDomainAnalysis.js'
import {
  listRulesForWorkspace,
  upsertRule,
  deleteRule,
  setAnalysisApproval,
  getEffectiveDomainDecision,
  revertDisavowForSource,
  invalidateClassificationRuleCaches
} from '../services/classificationService.js'
import { buildDisavowContent } from '../services/disavowService.js'
import { GeneratedDisavow } from '../models/GeneratedDisavow.js'
import { recomputeAnalysesForManagedDomain } from '../services/aggregateSourceDomains.js'
import {
  refreshEffectiveDecisionsForManagedDomain,
  refreshEffectiveDecisionsForManagedDomainSources,
  refreshEffectiveDecisionAcrossWorkspaceForSource
} from '../services/effectiveDecisionCache.js'
import { User } from '../models/User.js'
import { requireWorkspaceAdmin } from '../middleware/requireWorkspaceAdmin.js'
import { WorkspaceInvite } from '../models/WorkspaceInvite.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
})

const diskUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, os.tmpdir()),
    filename: (_req, _file, cb) => cb(null, `disavow-${randomUUID()}.csv`)
  }),
  limits: { fileSize: 100 * 1024 * 1024 }
})

const router = Router()
router.use(requireAuth)

router.get('/workspaces', async (req, res, next) => {
  try {
    const members = await WorkspaceMember.find({ userId: req.user._id }).lean()
    const ids = members.map((m) => m.workspaceId)
    const workspaces = await Workspace.find({ _id: { $in: ids } }).lean()
    res.json({ workspaces })
  } catch (e) {
    next(e)
  }
})

router.post('/workspaces', async (req, res, next) => {
  try {
    const { name } = req.body
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Workspace name required' })
    }
    const ws = await Workspace.create({
      name: String(name).trim(),
      createdBy: req.user._id
    })
    await WorkspaceMember.create({
      workspaceId: ws._id,
      userId: req.user._id,
      role: 'owner'
    })
    res.status(201).json(ws)
  } catch (e) {
    next(e)
  }
})

router.get('/workspaces/:workspaceId', requireWorkspaceMember(), async (req, res, next) => {
  try {
    const ws = await Workspace.findById(req.workspaceId).lean()
    const domainCount = await ManagedDomain.countDocuments({ workspaceId: req.workspaceId })
    res.json({ ...ws, managedDomainCount: domainCount })
  } catch (e) {
    next(e)
  }
})

router.patch(
  '/workspaces/:workspaceId',
  requireWorkspaceMember(),
  requireWorkspaceAdmin,
  async (req, res, next) => {
    try {
      const { name } = req.body
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'Workspace name required' })
      }
      const ws = await Workspace.findByIdAndUpdate(
        req.workspaceId,
        { name: String(name).trim() },
        { new: true }
      ).lean()
      if (!ws) return res.status(404).json({ error: 'Workspace not found' })
      res.json(ws)
    } catch (e) {
      next(e)
    }
  }
)

router.get(
  '/workspaces/:workspaceId/me',
  requireWorkspaceMember(),
  async (req, res, next) => {
    try {
      res.json({ role: req.workspaceRole })
    } catch (e) {
      next(e)
    }
  }
)

router.get(
  '/workspaces/:workspaceId/members',
  requireWorkspaceMember(),
  async (req, res, next) => {
    try {
      const members = await WorkspaceMember.find({ workspaceId: req.workspaceId })
        .populate('userId', 'email displayName')
        .lean()
      res.json({ members })
    } catch (e) {
      next(e)
    }
  }
)

router.post(
  '/workspaces/:workspaceId/members',
  requireWorkspaceMember(),
  requireWorkspaceAdmin,
  async (req, res, next) => {
    try {
      const email = String(req.body.email || '')
        .trim()
        .toLowerCase()
      if (!email) return res.status(400).json({ error: 'email required' })
      const user = await User.findOne({ email })
      if (!user) {
        return res.status(404).json({
          error:
            'No account with that email. The person must sign in to the app once so their account exists.'
        })
      }
      if (user._id.equals(req.user._id)) {
        return res.status(400).json({ error: 'Already a member' })
      }
      const role = ['admin', 'member'].includes(req.body.role) ? req.body.role : 'member'
      try {
        await WorkspaceMember.create({
          workspaceId: req.workspaceId,
          userId: user._id,
          role
        })
      } catch (e) {
        if (e.code === 11000) {
          return res.status(409).json({ error: 'User is already in this workspace' })
        }
        throw e
      }
      res.status(201).json({ ok: true, userId: user._id, email: user.email, role })
    } catch (e) {
      next(e)
    }
  }
)

router.post(
  '/workspaces/:workspaceId/invites',
  requireWorkspaceMember(),
  requireWorkspaceAdmin,
  async (req, res, next) => {
    try {
      const email = String(req.body.email || '')
        .trim()
        .toLowerCase()
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email required' })
      }
      const role = req.body.role === 'admin' ? 'admin' : 'member'
      const user = await User.findOne({ email })
      if (user) {
        const mem = await WorkspaceMember.findOne({
          workspaceId: req.workspaceId,
          userId: user._id
        })
        if (mem) {
          return res.status(400).json({ error: 'That user is already a member' })
        }
      }
      await WorkspaceInvite.deleteMany({ workspaceId: req.workspaceId, email })
      const token = randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      await WorkspaceInvite.create({
        workspaceId: req.workspaceId,
        email,
        token,
        role,
        invitedBy: req.user._id,
        expiresAt
      })
      res.status(201).json({
        token,
        email,
        role,
        expiresAt
      })
    } catch (e) {
      next(e)
    }
  }
)

router.get(
  '/workspaces/:workspaceId/invites',
  requireWorkspaceMember(),
  requireWorkspaceAdmin,
  async (req, res, next) => {
    try {
      const list = await WorkspaceInvite.find({ workspaceId: req.workspaceId })
        .sort({ createdAt: -1 })
        .select('email role expiresAt createdAt token')
        .lean()
      res.json({ invites: list })
    } catch (e) {
      next(e)
    }
  }
)

router.delete(
  '/workspaces/:workspaceId/invites/:inviteId',
  requireWorkspaceMember(),
  requireWorkspaceAdmin,
  async (req, res, next) => {
    try {
      const r = await WorkspaceInvite.findOneAndDelete({
        _id: req.params.inviteId,
        workspaceId: req.workspaceId
      })
      if (!r) return res.status(404).json({ error: 'Invite not found' })
      res.json({ ok: true })
    } catch (e) {
      next(e)
    }
  }
)

router.delete(
  '/workspaces/:workspaceId/members/:memberId',
  requireWorkspaceMember(),
  requireWorkspaceAdmin,
  async (req, res, next) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.memberId)) {
        return res.status(400).json({ error: 'Invalid member id' })
      }
      const m = await WorkspaceMember.findOne({
        _id: req.params.memberId,
        workspaceId: req.workspaceId
      })
      if (!m) return res.status(404).json({ error: 'Member not found' })
      if (m.userId.equals(req.user._id)) {
        return res.status(400).json({ error: 'You cannot remove yourself' })
      }
      if (m.role === 'owner') {
        const owners = await WorkspaceMember.countDocuments({
          workspaceId: req.workspaceId,
          role: 'owner'
        })
        if (owners <= 1) {
          return res.status(400).json({ error: 'Cannot remove the last owner' })
        }
      }
      await m.deleteOne()
      res.json({ ok: true })
    } catch (e) {
      next(e)
    }
  }
)

router.get(
  '/workspaces/:workspaceId/managed-domains',
  requireWorkspaceMember(),
  async (req, res, next) => {
    try {
      const list = await ManagedDomain.find({ workspaceId: req.workspaceId })
        .sort({ createdAt: -1 })
        .lean()
      res.json({ domains: list })
    } catch (e) {
      next(e)
    }
  }
)

router.post(
  '/workspaces/:workspaceId/managed-domains',
  requireWorkspaceMember(),
  async (req, res, next) => {
    try {
      const { domainName, displayName, notes } = req.body
      if (!domainName || !String(domainName).trim()) {
        return res.status(400).json({ error: 'domainName required' })
      }
      const normalized = String(domainName)
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .split('/')[0]
      const doc = await ManagedDomain.create({
        workspaceId: req.workspaceId,
        domainName: normalized,
        displayName: displayName || normalized,
        notes: notes || '',
        createdBy: req.user._id
      })
      res.status(201).json(doc)
    } catch (e) {
      if (e.code === 11000) {
        return res.status(409).json({ error: 'Domain already exists in workspace' })
      }
      next(e)
    }
  }
)

async function loadDomainInWorkspace(workspaceId, domainId) {
  if (!mongoose.Types.ObjectId.isValid(domainId)) return null
  const d = await ManagedDomain.findOne({
    _id: domainId,
    workspaceId
  }).lean()
  return d
}

router.get(
  '/workspaces/:workspaceId/managed-domains/:domainId',
  requireWorkspaceMember(),
  async (req, res, next) => {
    try {
      const d = await loadDomainInWorkspace(req.workspaceId, req.params.domainId)
      if (!d) return res.status(404).json({ error: 'Managed domain not found' })
      const uploadCount = await BacklinkUpload.countDocuments({ managedDomainId: d._id })
      const rowCount = await BacklinkRow.countDocuments({ managedDomainId: d._id })
      const analysisCount = await SourceDomainAnalysis.countDocuments({ managedDomainId: d._id })
      const { entrySummary } = await buildDisavowContent({
        workspaceId: req.workspaceId,
        managedDomainId: d._id
      })
      res.json({
        ...d,
        stats: {
          uploadCount,
          rowCount,
          analysisCount,
          disavowedDomainCount: entrySummary.domainCount
        }
      })
    } catch (e) {
      next(e)
    }
  }
)

router.patch(
  '/workspaces/:workspaceId/managed-domains/:domainId',
  requireWorkspaceMember(),
  async (req, res, next) => {
    try {
      const d = await ManagedDomain.findOne({
        _id: req.params.domainId,
        workspaceId: req.workspaceId
      })
      if (!d) return res.status(404).json({ error: 'Not found' })
      const { displayName, notes } = req.body
      if (displayName !== undefined) d.displayName = String(displayName)
      if (notes !== undefined) d.notes = String(notes)
      await d.save()
      res.json(d)
    } catch (e) {
      next(e)
    }
  }
)

router.delete(
  '/workspaces/:workspaceId/managed-domains/:domainId',
  requireWorkspaceMember(),
  requireWorkspaceAdmin,
  async (req, res, next) => {
    try {
      const r = await ManagedDomain.findOneAndDelete({
        _id: req.params.domainId,
        workspaceId: req.workspaceId
      })
      if (!r) return res.status(404).json({ error: 'Not found' })
      await BacklinkRow.deleteMany({ managedDomainId: r._id })
      await BacklinkUpload.deleteMany({ managedDomainId: r._id })
      await SourceDomainAnalysis.deleteMany({ managedDomainId: r._id })
      await ClassificationRule.deleteMany({ managedDomainId: r._id })
      await GeneratedDisavow.deleteMany({ managedDomainId: r._id })
      res.json({ ok: true })
    } catch (e) {
      next(e)
    }
  }
)

router.post(
  '/workspaces/:workspaceId/managed-domains/:domainId/uploads',
  requireWorkspaceMember(),
  diskUpload.single('file'),
  async (req, res, next) => {
    try {
      const d = await loadDomainInWorkspace(req.workspaceId, req.params.domainId)
      if (!d) return res.status(404).json({ error: 'Managed domain not found' })
      const filePath = req.file?.path
      if (!filePath) {
        return res.status(400).json({ error: 'CSV file required (field: file)' })
      }
      const bu = await BacklinkUpload.create({
        managedDomainId: d._id,
        workspaceId: req.workspaceId,
        filename: req.file.originalname || 'upload.csv',
        uploadedBy: req.user._id,
        status: 'processing'
      })
      const opts = {
        uploadId: bu._id,
        managedDomainId: d._id,
        workspaceId: req.workspaceId,
        userId: req.user._id
      }
      ;(async () => {
        try {
          await processCsvFileStream(filePath, opts)
        } catch (err) {
          console.error('CSV stream import error', err)
          await BacklinkUpload.findByIdAndUpdate(bu._id, {
            status: 'failed',
            errorMessage: String(err.message || err)
          })
        } finally {
          await fs.unlink(filePath).catch(() => {})
        }
      })()
      res.status(202).json({
        upload: bu,
        message: 'Import started; poll uploads list for status'
      })
    } catch (e) {
      next(e)
    }
  }
)

router.post(
  '/workspaces/:workspaceId/managed-domains/:domainId/uploads-sync',
  requireWorkspaceMember(),
  upload.single('file'),
  async (req, res, next) => {
    try {
      const d = await loadDomainInWorkspace(req.workspaceId, req.params.domainId)
      if (!d) return res.status(404).json({ error: 'Managed domain not found' })
      if (!req.file?.buffer) {
        return res.status(400).json({ error: 'CSV file required' })
      }
      const bu = await BacklinkUpload.create({
        managedDomainId: d._id,
        workspaceId: req.workspaceId,
        filename: req.file.originalname || 'upload.csv',
        uploadedBy: req.user._id,
        status: 'processing'
      })
      const result = await processCsvBuffer(req.file.buffer, {
        uploadId: bu._id,
        managedDomainId: d._id,
        workspaceId: req.workspaceId,
        userId: req.user._id
      })
      const updated = await BacklinkUpload.findById(bu._id).lean()
      res.status(201).json({ upload: updated, ...result })
    } catch (e) {
      next(e)
    }
  }
)

router.get(
  '/workspaces/:workspaceId/managed-domains/:domainId/uploads',
  requireWorkspaceMember(),
  async (req, res, next) => {
    try {
      const d = await loadDomainInWorkspace(req.workspaceId, req.params.domainId)
      if (!d) return res.status(404).json({ error: 'Not found' })
      const list = await BacklinkUpload.find({ managedDomainId: d._id })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean()
      res.json({ uploads: list })
    } catch (e) {
      next(e)
    }
  }
)

router.get(
  '/workspaces/:workspaceId/managed-domains/:domainId/uploads/:uploadId',
  requireWorkspaceMember(),
  async (req, res, next) => {
    try {
      const d = await loadDomainInWorkspace(req.workspaceId, req.params.domainId)
      if (!d) return res.status(404).json({ error: 'Not found' })
      const u = await BacklinkUpload.findOne({
        _id: req.params.uploadId,
        managedDomainId: d._id
      }).lean()
      if (!u) return res.status(404).json({ error: 'Upload not found' })
      res.json({ upload: u })
    } catch (e) {
      next(e)
    }
  }
)

router.get(
  '/workspaces/:workspaceId/managed-domains/:domainId/rows',
  requireWorkspaceMember(),
  async (req, res, next) => {
    try {
      const d = await loadDomainInWorkspace(req.workspaceId, req.params.domainId)
      if (!d) return res.status(404).json({ error: 'Not found' })
      const page = Math.max(1, parseInt(req.query.page, 10) || 1)
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25))
      const q = { managedDomainId: d._id }
      if (req.query.sourceRootDomain) {
        q.sourceRootDomain = String(req.query.sourceRootDomain).toLowerCase()
      }
      if (req.query.search) {
        const s = String(req.query.search)
        q.$or = [
          { sourceUrl: new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
          { anchor: new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
        ]
      }
      const [items, total] = await Promise.all([
        BacklinkRow.find(q)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        BacklinkRow.countDocuments(q)
      ])
      res.json({ rows: items, total, page, limit })
    } catch (e) {
      next(e)
    }
  }
)

router.get(
  '/workspaces/:workspaceId/managed-domains/:domainId/source-domains',
  requireWorkspaceMember(),
  async (req, res, next) => {
    try {
      const d = await loadDomainInWorkspace(req.workspaceId, req.params.domainId)
      if (!d) return res.status(404).json({ error: 'Not found' })
      const page = Math.max(1, parseInt(req.query.page, 10) || 1)
      const decisionQ = req.query.decision
      const hasSearch = Boolean(String(req.query.search || '').trim())
      if (page === 1 || decisionQ === 'blacklist' || hasSearch) {
        await refreshEffectiveDecisionsForManagedDomain(d._id, req.workspaceId)
      }
      const filter = { managedDomainId: d._id }
      if (req.query.search) {
        filter.sourceRootDomain = new RegExp(
          String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          'i'
        )
      }
      if (decisionQ === 'unclassified') {
        filter.$and = [
          { $or: [{ effectiveDecision: null }, { effectiveDecision: '' }] },
          { userApprovedForDisavow: { $ne: true } }
        ]
      } else if (decisionQ === 'blacklist') {
        filter.$or = [
          { effectiveDecision: 'blacklist' },
          { userApprovedForDisavow: true }
        ]
      } else if (
        decisionQ &&
        ['whitelist', 'needs_review', 'ignore'].includes(decisionQ)
      ) {
        filter.effectiveDecision = decisionQ
      }
      let sort = { rowCount: -1 }
      if (req.query.sort === 'ascore') sort = { avgPageAscore: 1 }
      if (req.query.sort === 'recommendation') sort = { 'recommendation.score': -1 }
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50))
      const [total, list] = await Promise.all([
        SourceDomainAnalysis.countDocuments(filter),
        SourceDomainAnalysis.find(filter)
          .sort(sort)
          .skip((page - 1) * limit)
          .limit(limit)
          .lean()
      ])
      const sourceDomains = await Promise.all(
        list.map(async (a) => {
          const needsKind =
            a.effectiveDecision === 'blacklist' || a.userApprovedForDisavow
          let disavowKind = null
          if (needsKind) {
            const eff = await getEffectiveDomainDecision(req.workspaceId, d._id, a.sourceRootDomain)
            if (eff.decision === 'blacklist') {
              disavowKind = eff.scope === 'workspace' ? 'global' : 'local'
            } else if (a.userApprovedForDisavow && eff.decision !== 'whitelist') {
              disavowKind = 'approved'
            }
          }
          return {
            ...a,
            effectiveDecision: a.effectiveDecision ?? null,
            disavowKind
          }
        })
      )
      res.json({ sourceDomains, total, page, limit })
    } catch (e) {
      next(e)
    }
  }
)

router.get(
  '/workspaces/:workspaceId/managed-domains/:domainId/review-queue',
  requireWorkspaceMember(),
  async (req, res, next) => {
    try {
      const d = await loadDomainInWorkspace(req.workspaceId, req.params.domainId)
      if (!d) return res.status(404).json({ error: 'Not found' })
      const legacy = await SourceDomainAnalysis.countDocuments({
        managedDomainId: d._id,
        effectiveDecision: { $exists: false }
      })
      if (legacy > 0) {
        await refreshEffectiveDecisionsForManagedDomain(d._id, req.workspaceId)
      }
      const page = Math.max(1, parseInt(req.query.page, 10) || 1)
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 40))
      const filter = {
        managedDomainId: d._id,
        userApprovedForDisavow: { $ne: true },
        $or: [
          { effectiveDecision: 'needs_review' },
          {
            effectiveDecision: null,
            'recommendation.score': { $gte: 22 }
          }
        ]
      }
      const [total, list] = await Promise.all([
        SourceDomainAnalysis.countDocuments(filter),
        SourceDomainAnalysis.find(filter)
          .sort({ 'recommendation.score': -1, rowCount: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean()
      ])
      res.json({
        items: list.map((a) => ({
          ...a,
          effectiveDecision: a.effectiveDecision ?? null
        })),
        total,
        page,
        limit
      })
    } catch (e) {
      next(e)
    }
  }
)

router.get(
  '/workspaces/:workspaceId/managed-domains/:domainId/source-domains/:root/detail',
  requireWorkspaceMember(),
  async (req, res, next) => {
    try {
      const d = await loadDomainInWorkspace(req.workspaceId, req.params.domainId)
      if (!d) return res.status(404).json({ error: 'Not found' })
      const root = decodeURIComponent(req.params.root).toLowerCase()
      const analysis = await SourceDomainAnalysis.findOne({
        managedDomainId: d._id,
        sourceRootDomain: root
      }).lean()
      const urls = await BacklinkRow.distinct('sourceUrl', {
        managedDomainId: d._id,
        sourceRootDomain: root
      })
      const anchors = await BacklinkRow.distinct('anchor', {
        managedDomainId: d._id,
        sourceRootDomain: root
      })
      const targets = await BacklinkRow.distinct('targetUrl', {
        managedDomainId: d._id,
        sourceRootDomain: root
      })
      const eff = await getEffectiveDomainDecision(req.workspaceId, d._id, root)
      res.json({
        analysis,
        sourceUrls: urls,
        anchors: anchors.filter(Boolean),
        targetUrls: targets.filter(Boolean),
        effectiveDecision: eff.decision
      })
    } catch (e) {
      next(e)
    }
  }
)

router.post(
  '/workspaces/:workspaceId/managed-domains/:domainId/classifications/bulk',
  requireWorkspaceMember(),
  async (req, res, next) => {
    try {
      const d = await loadDomainInWorkspace(req.workspaceId, req.params.domainId)
      if (!d) return res.status(404).json({ error: 'Managed domain not found' })
      const { decision, sourceRootDomains } = req.body
      if (!['whitelist', 'blacklist', 'needs_review', 'ignore'].includes(decision)) {
        return res.status(400).json({ error: 'invalid decision' })
      }
      const roots = Array.isArray(sourceRootDomains) ? sourceRootDomains : []
      if (!roots.length) {
        return res.status(400).json({ error: 'sourceRootDomains array required' })
      }
      if (roots.length > 300) {
        return res.status(400).json({ error: 'Maximum 300 domains per bulk request' })
      }
      const rootsNorm = []
      for (const root of roots) {
        const v = String(root).toLowerCase()
        rootsNorm.push(v)
        await upsertRule(
          {
            workspaceId: req.workspaceId,
            managedDomainId: d._id,
            entityType: 'source_domain',
            value: v,
            decision,
            notes: '',
            userId: req.user._id,
            manual: true
          },
          { skipCacheInvalidate: true }
        )
      }
      invalidateClassificationRuleCaches(req.workspaceId)
      await refreshEffectiveDecisionsForManagedDomainSources(
        req.workspaceId,
        d._id,
        rootsNorm
      )
      res.json({ ok: true, count: roots.length })
    } catch (e) {
      next(e)
    }
  }
)

router.get(
  '/workspaces/:workspaceId/classifications',
  requireWorkspaceMember(),
  async (req, res, next) => {
    try {
      const workspaceOnly = req.query.scope === 'workspace'
      const mdOnly = req.query.managedDomainId
      let rules
      if (workspaceOnly) {
        rules = await listRulesForWorkspace(req.workspaceId, { managedDomainId: null })
      } else if (mdOnly && mongoose.Types.ObjectId.isValid(mdOnly)) {
        rules = await listRulesForWorkspace(req.workspaceId, {
          managedDomainId: mdOnly
        })
      } else {
        rules = await ClassificationRule.find({ workspaceId: req.workspaceId })
          .sort({ updatedAt: -1 })
          .lean()
      }
      res.json({ rules })
    } catch (e) {
      next(e)
    }
  }
)

router.post(
  '/workspaces/:workspaceId/classifications',
  requireWorkspaceMember(),
  async (req, res, next) => {
    try {
      const {
        managedDomainId,
        entityType,
        value,
        decision,
        notes,
        manual
      } = req.body
      if (!['source_domain', 'source_url'].includes(entityType)) {
        return res.status(400).json({ error: 'entityType must be source_domain or source_url' })
      }
      if (!['whitelist', 'blacklist', 'needs_review', 'ignore'].includes(decision)) {
        return res.status(400).json({ error: 'invalid decision' })
      }
      let md = null
      if (managedDomainId) {
        const d = await loadDomainInWorkspace(req.workspaceId, managedDomainId)
        if (!d) return res.status(400).json({ error: 'Invalid managedDomainId' })
        md = d._id
      }
      const rule = await upsertRule({
        workspaceId: req.workspaceId,
        managedDomainId: md,
        entityType,
        value,
        decision,
        notes,
        userId: req.user._id,
        manual: !!manual
      })
      if (entityType === 'source_domain') {
        const root = String(value).toLowerCase()
        if (md) {
          await refreshEffectiveDecisionsForManagedDomainSources(req.workspaceId, md, [root])
        } else {
          await refreshEffectiveDecisionAcrossWorkspaceForSource(req.workspaceId, root)
        }
      }
      res.json(rule)
    } catch (e) {
      next(e)
    }
  }
)

router.delete(
  '/workspaces/:workspaceId/classifications/:ruleId',
  requireWorkspaceMember(),
  async (req, res, next) => {
    try {
      const existing = await ClassificationRule.findOne({
        _id: req.params.ruleId,
        workspaceId: req.workspaceId
      }).lean()
      const r = await deleteRule(req.params.ruleId, req.workspaceId)
      if (!r) return res.status(404).json({ error: 'Not found' })
      if (existing?.entityType === 'source_domain') {
        const v = String(existing.value).toLowerCase()
        if (existing.managedDomainId) {
          await refreshEffectiveDecisionsForManagedDomainSources(
            req.workspaceId,
            existing.managedDomainId,
            [v]
          )
        } else {
          await refreshEffectiveDecisionAcrossWorkspaceForSource(req.workspaceId, v)
        }
      }
      res.json({ ok: true })
    } catch (e) {
      next(e)
    }
  }
)

router.post(
  '/workspaces/:workspaceId/managed-domains/:domainId/source-domains/:root/revert-disavow',
  requireWorkspaceMember(),
  async (req, res, next) => {
    try {
      const d = await loadDomainInWorkspace(req.workspaceId, req.params.domainId)
      if (!d) return res.status(404).json({ error: 'Not found' })
      const root = decodeURIComponent(req.params.root).toLowerCase()
      await revertDisavowForSource({
        workspaceId: req.workspaceId,
        managedDomainId: d._id,
        sourceRootDomain: root,
        userId: req.user._id
      })
      await refreshEffectiveDecisionsForManagedDomainSources(req.workspaceId, d._id, [root])
      res.json({ ok: true })
    } catch (e) {
      next(e)
    }
  }
)

router.post(
  '/workspaces/:workspaceId/managed-domains/:domainId/analysis/approve',
  requireWorkspaceMember(),
  async (req, res, next) => {
    try {
      const d = await loadDomainInWorkspace(req.workspaceId, req.params.domainId)
      if (!d) return res.status(404).json({ error: 'Not found' })
      const { sourceRootDomain, approved } = req.body
      const doc = await setAnalysisApproval(d._id, sourceRootDomain, !!approved)
      res.json(doc)
    } catch (e) {
      next(e)
    }
  }
)

router.post(
  '/workspaces/:workspaceId/managed-domains/:domainId/disavow/preview',
  requireWorkspaceMember(),
  async (req, res, next) => {
    try {
      const d = await loadDomainInWorkspace(req.workspaceId, req.params.domainId)
      if (!d) return res.status(404).json({ error: 'Not found' })
      const out = await buildDisavowContent({
        workspaceId: req.workspaceId,
        managedDomainId: d._id
      })
      res.json(out)
    } catch (e) {
      next(e)
    }
  }
)

router.post(
  '/workspaces/:workspaceId/managed-domains/:domainId/disavow/export',
  requireWorkspaceMember(),
  async (req, res, next) => {
    try {
      const d = await loadDomainInWorkspace(req.workspaceId, req.params.domainId)
      if (!d) return res.status(404).json({ error: 'Not found' })
      const { content, entrySummary } = await buildDisavowContent({
        workspaceId: req.workspaceId,
        managedDomainId: d._id
      })
      const lines = content.split('\n').filter((l) => l.trim() && !l.startsWith('#'))
      const saved = await GeneratedDisavow.create({
        managedDomainId: d._id,
        workspaceId: req.workspaceId,
        content,
        lineCount: lines.length,
        entrySummary,
        createdBy: req.user._id
      })
      res.json({
        id: saved._id,
        content,
        entrySummary,
        createdAt: saved.createdAt
      })
    } catch (e) {
      next(e)
    }
  }
)

router.get(
  '/workspaces/:workspaceId/managed-domains/:domainId/disavows',
  requireWorkspaceMember(),
  async (req, res, next) => {
    try {
      const d = await loadDomainInWorkspace(req.workspaceId, req.params.domainId)
      if (!d) return res.status(404).json({ error: 'Not found' })
      const list = await GeneratedDisavow.find({ managedDomainId: d._id })
        .sort({ createdAt: -1 })
        .limit(30)
        .select('content createdAt lineCount entrySummary')
        .lean()
      res.json({ disavows: list })
    } catch (e) {
      next(e)
    }
  }
)

router.post(
  '/workspaces/:workspaceId/managed-domains/:domainId/analysis/recompute',
  requireWorkspaceMember(),
  async (req, res, next) => {
    try {
      const d = await loadDomainInWorkspace(req.workspaceId, req.params.domainId)
      if (!d) return res.status(404).json({ error: 'Not found' })
      const n = await recomputeAnalysesForManagedDomain(d._id, req.workspaceId, req.user._id)
      res.json({
        recomputed: n.analysisCount,
        workspaceBlacklistApplied: n.workspaceBlacklistApplied
      })
    } catch (e) {
      next(e)
    }
  }
)

export default router
