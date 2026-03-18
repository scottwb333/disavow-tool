import { Router } from 'express'
import { WorkspaceInvite } from '../models/WorkspaceInvite.js'
import { Workspace } from '../models/Workspace.js'
import { WorkspaceMember } from '../models/WorkspaceMember.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()

function maskEmail(email) {
  const [local, domain] = String(email).split('@')
  if (!domain) return '***'
  const show = local.slice(0, 2)
  return `${show}***@${domain}`
}

router.get('/invites/:token', async (req, res, next) => {
  try {
    const token = String(req.params.token || '').trim()
    if (token.length < 32) {
      return res.status(404).json({ error: 'Invalid invite' })
    }
    const inv = await WorkspaceInvite.findOne({ token }).lean()
    if (!inv || new Date(inv.expiresAt) < new Date()) {
      return res.status(404).json({ error: 'Invite expired or not found' })
    }
    const ws = await Workspace.findById(inv.workspaceId).select('name').lean()
    if (!ws) return res.status(404).json({ error: 'Workspace not found' })
    res.json({
      workspaceName: ws.name,
      emailHint: maskEmail(inv.email),
      role: inv.role,
      expiresAt: inv.expiresAt
    })
  } catch (e) {
    next(e)
  }
})

router.post('/invites/:token/accept', requireAuth, async (req, res, next) => {
  try {
    const token = String(req.params.token || '').trim()
    const inv = await WorkspaceInvite.findOne({ token })
    if (!inv || new Date(inv.expiresAt) < new Date()) {
      return res.status(404).json({ error: 'Invite expired or not found' })
    }
    const userEmail = (req.user.email || '').toLowerCase().trim()
    if (!userEmail || userEmail !== inv.email) {
      return res.status(403).json({
        error: `Sign in as ${maskEmail(inv.email)} to accept this invite.`
      })
    }
    const existing = await WorkspaceMember.findOne({
      workspaceId: inv.workspaceId,
      userId: req.user._id
    })
    if (existing) {
      await WorkspaceInvite.deleteOne({ _id: inv._id })
      return res.json({
        ok: true,
        alreadyMember: true,
        workspaceId: inv.workspaceId
      })
    }
    try {
      await WorkspaceMember.create({
        workspaceId: inv.workspaceId,
        userId: req.user._id,
        role: inv.role === 'admin' ? 'admin' : 'member'
      })
    } catch (e) {
      if (e.code === 11000) {
        await WorkspaceInvite.deleteOne({ _id: inv._id })
        return res.json({ ok: true, alreadyMember: true, workspaceId: inv.workspaceId })
      }
      throw e
    }
    await WorkspaceInvite.deleteOne({ _id: inv._id })
    res.status(201).json({ ok: true, workspaceId: inv.workspaceId })
  } catch (e) {
    next(e)
  }
})

export default router
