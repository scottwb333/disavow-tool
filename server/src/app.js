import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { connectDb } from './config/db.js'
import { initFirebase } from './config/firebase.js'
import { errorHandler } from './middleware/errorHandler.js'
import authRoutes from './routes/auth.js'
import invitesPublicRoutes from './routes/invitesPublic.js'
import workspaceRoutes from './routes/workspaces.js'

const app = express()
const origin = process.env.CLIENT_ORIGIN || 'http://localhost:3005'
app.use(cors({ origin, credentials: true }))
app.use(express.json({ limit: '2mb' }))

if (!initFirebase()) {
  console.warn('Firebase not configured — protected routes will return 503 until FIREBASE_SERVICE_ACCOUNT_JSON is set')
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

app.use('/api', invitesPublicRoutes)
app.use('/api', authRoutes)
app.use('/api', workspaceRoutes)

app.use(errorHandler)

const PORT = process.env.PORT || 4000

connectDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API http://localhost:${PORT}`)
    })
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
