import { getAuth } from '../config/firebase.js'
import { User } from '../models/User.js'

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) {
      return res.status(401).json({ error: 'Missing bearer token' })
    }
    let decoded
    try {
      decoded = await getAuth().verifyIdToken(token)
    } catch (e) {
      if (e.status === 503) {
        return res.status(503).json({ error: e.message })
      }
      return res.status(401).json({ error: 'Invalid or expired token' })
    }
    let user = await User.findOne({ firebaseUid: decoded.uid })
    if (!user) {
      user = await User.create({
        firebaseUid: decoded.uid,
        email: (decoded.email || '').toLowerCase(),
        displayName: decoded.name || ''
      })
    } else if (decoded.email && user.email !== decoded.email) {
      user.email = (decoded.email || '').toLowerCase()
      await user.save()
    }
    req.user = user
    req.firebaseUid = decoded.uid
    next()
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Auth failed' })
  }
}
