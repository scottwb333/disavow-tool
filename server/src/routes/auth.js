import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()
router.post('/auth/bootstrap', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      email: req.user.email,
      displayName: req.user.displayName
    }
  })
})

export default router
