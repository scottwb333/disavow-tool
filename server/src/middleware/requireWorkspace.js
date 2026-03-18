import mongoose from 'mongoose'
import { WorkspaceMember } from '../models/WorkspaceMember.js'

export function requireWorkspaceMember({ paramName = 'workspaceId' } = {}) {
  return async (req, res, next) => {
    try {
      const id = req.params[paramName]
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid workspace id' })
      }
      const member = await WorkspaceMember.findOne({
        workspaceId: id,
        userId: req.user._id
      })
      if (!member) {
        return res.status(403).json({ error: 'Not a member of this workspace' })
      }
      req.workspaceId = id
      req.workspaceRole = member.role
      next()
    } catch (e) {
      next(e)
    }
  }
}
