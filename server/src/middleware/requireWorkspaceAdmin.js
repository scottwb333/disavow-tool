export function requireWorkspaceAdmin(req, res, next) {
  if (!['owner', 'admin'].includes(req.workspaceRole)) {
    return res.status(403).json({ error: 'Owner or admin role required' })
  }
  next()
}
